import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Configuration and branch tracking file utilities
 */

export interface VersionTag {
	[tagName: string]: {
		versionSuffixStrategy: "timestamp" | "increment";
		next?: string;
	};
}

export type BumpType = "patch" | "minor" | "major";
export type Registry = "npm" | "crates" | "docker";

export interface Project {
	path: string;
	type: string;
	baseVersion: string;
	deps: string[];
	registries: Registry[];
}

export interface Config {
	versioningStrategy: "fixed" | "independent";
	versionTags: VersionTag[];
	projects: Project[];
	releaseNotes?: {
		enabled: boolean;
		template: string;
	};
}

export interface BranchInfo {
	tag: string;
	parentBranch: string;
	projectUpdated?: Record<string, string>;
}

/**
 * Check if cd-tools has been initialized
 */
export async function checkInitialized(): Promise<boolean> {
	try {
		await access(".cdtools/config.json");
		return true;
	} catch {
		return false;
	}
}

/**
 * Load configuration file
 */
export async function loadConfig(): Promise<Config> {
	try {
		const content = await readFile(".cdtools/config.json", "utf-8");
		return JSON.parse(content) as Config;
	} catch (error) {
		throw new Error(
			`Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Escape branch name for use in filename
 * Replace characters that are not suitable for filenames
 */
export function escapeBranchNameForFilename(branchName: string): string {
	return branchName.replace(/[/\\:*?"<>|]/g, "-");
}

/**
 * Create branch tracking file
 */
export async function createBranchInfo(
	releaseMode: string,
	branchName: string,
	parentBranch: string,
): Promise<void> {
	const escapedBranchName = escapeBranchNameForFilename(branchName);
	const filename = `.cdtools/${releaseMode}-${escapedBranchName}.json`;

	const branchInfo: BranchInfo = {
		tag: releaseMode,
		parentBranch: parentBranch,
	};

	try {
		await writeFile(filename, `${JSON.stringify(branchInfo, null, "\t")}\n`);
	} catch (error) {
		throw new Error(
			`Failed to create branch info file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Parse current branch name to extract tag and original branch name
 * Format: branchName(tag) -> returns { branchName, tag }
 */
export function parseBranchName(
	fullBranchName: string,
): { branchName: string; tag: string } | null {
	const match = fullBranchName.match(/^(.+)\(([^)]+)\)$/);
	if (!match || !match[1] || !match[2]) {
		return null;
	}
	return {
		branchName: match[1],
		tag: match[2],
	};
}

/**
 * Load branch info file for current branch
 */
export async function loadBranchInfo(
	currentBranch: string,
): Promise<BranchInfo | null> {
	const parsed = parseBranchName(currentBranch);
	if (!parsed) {
		return null;
	}

	const escapedBranchName = escapeBranchNameForFilename(parsed.branchName);
	const filename = `.cdtools/${parsed.tag}-${escapedBranchName}.json`;

	try {
		const content = await readFile(filename, "utf-8");
		return JSON.parse(content) as BranchInfo;
	} catch {
		return null;
	}
}

/**
 * Update branch info file with workspace updates and optionally tag
 */
export async function updateBranchInfo(
	currentBranch: string,
	projectUpdated: Record<string, string>,
	tag?: string,
): Promise<void> {
	const branchInfo = await loadBranchInfo(currentBranch);
	if (!branchInfo) {
		throw new Error("Branch info file not found");
	}

	// Create new branch info object to avoid mutation
	const updatedBranchInfo: BranchInfo = {
		...branchInfo,
		projectUpdated,
		...(tag && { tag }),
	};

	const parsed = parseBranchName(currentBranch);
	if (!parsed) {
		throw new Error("Invalid branch name format");
	}

	const escapedBranchName = escapeBranchNameForFilename(parsed.branchName);
	const filename = `.cdtools/${parsed.tag}-${escapedBranchName}.json`;

	try {
		await writeFile(
			filename,
			`${JSON.stringify(updatedBranchInfo, null, "\t")}\n`,
		);
	} catch (error) {
		throw new Error(
			`Failed to update branch info file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Extract available version tags from config
 */
export function getAvailableVersionTags(
	config: Config,
): Array<{ title: string; value: string }> {
	const tags: Array<{ title: string; value: string }> = [];
	const addedTags = new Set<string>();

	// Add configured version tags
	for (const versionTag of config.versionTags) {
		for (const tagName of Object.keys(versionTag)) {
			if (!addedTags.has(tagName)) {
				tags.push({ title: tagName, value: tagName });
				addedTags.add(tagName);
			}
		}
	}

	// Add stable tag (reserved word, always available)
	if (!addedTags.has("stable")) {
		tags.push({ title: "stable", value: "stable" });
		addedTags.add("stable");
	}

	return tags;
}

export function isStableTag(tagName: string): boolean {
	return tagName === "stable";
}

/**
 * Get the version tag configuration for a given tag name
 * For stable tags, returns a default configuration
 */
export function getVersionTagConfig(
	config: Config,
	tagName: string,
): { versionSuffixStrategy: "timestamp" | "increment"; next?: string } | null {
	// Check if tag is directly defined in versionTags
	for (const versionTag of config.versionTags) {
		if (tagName in versionTag) {
			return versionTag[tagName] ? versionTag[tagName] : null;
		}
	}

	// For stable tags, return a default configuration (no suffix strategy needed)
	if (isStableTag(tagName)) {
		return { versionSuffixStrategy: "increment" }; // Default, but won't be used for stable releases
	}

	return null;
}

/**
 * Compare two semantic versions to determine bump type
 * @param baseVersion - The base version (e.g., "1.0.0")
 * @param currentVersion - The current version (e.g., "1.1.0-alpha.1")
 * @returns The bump type or null if no change
 */
export function compareVersions(
	baseVersion: string,
	currentVersion: string,
): BumpType | null {
	// Extract base part from current version (remove pre-release suffix)
	const currentBasePart = currentVersion.split("-")[0];
	if (!currentBasePart) {
		return null;
	}

	const baseParts = baseVersion.split(".").map(Number);
	const currentParts = currentBasePart.split(".").map(Number);

	if (baseParts.length !== 3 || currentParts.length !== 3) {
		return null;
	}

	const [baseMajor, baseMinor, basePatch] = baseParts;
	const [currentMajor, currentMinor, currentPatch] = currentParts;

	if (
		baseMajor === undefined ||
		baseMinor === undefined ||
		basePatch === undefined ||
		currentMajor === undefined ||
		currentMinor === undefined ||
		currentPatch === undefined
	) {
		return null;
	}

	if (currentMajor > baseMajor) {
		return "major";
	}
	if (currentMinor > baseMinor) {
		return "minor";
	}
	if (currentPatch > basePatch) {
		return "patch";
	}

	return null; // No change
}

/**
 * Get the bump types that have occurred in this release cycle
 * @param config - The configuration
 * @param projectUpdated - The workspace updates from branch info
 * @returns Array of bump types that have occurred
 */
export function getBumpTypesFromprojectUpdated(
	config: Config,
	projectUpdated: Record<string, string>,
): BumpType[] {
	const bumpTypes = new Set<BumpType>();

	for (const [projectPath, currentVersion] of Object.entries(projectUpdated)) {
		const project = config.projects.find((p) => p.path === projectPath);
		if (!project) {
			continue;
		}

		const bumpType = compareVersions(project.baseVersion, currentVersion);
		if (bumpType) {
			bumpTypes.add(bumpType);
		}
	}

	return Array.from(bumpTypes);
}

/**
 * Update config.json with new project configurations
 * @param config - The updated configuration object
 */
export async function updateConfig(config: Config): Promise<void> {
	try {
		const configPath = path.join(".cdtools", "config.json");
		await writeFile(configPath, JSON.stringify(config, null, "\t"));
	} catch (error) {
		throw new Error(
			`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Delete branch info file for current branch
 * @param currentBranch - The current branch name
 */
export async function deleteBranchInfo(currentBranch: string): Promise<void> {
	try {
		// Parse current branch name to get branch name and tag
		const parsed = parseBranchName(currentBranch);
		if (!parsed) {
			throw new Error(`Invalid branch name format: ${currentBranch}`);
		}

		// Normalize branch name for comparison with filename
		// Replace first slash with dash, ignore everything after (and including) opening parenthesis
		const normalizedBranchName = parsed.branchName
			.replace(/^([^/]+)\//, "$1-") // Replace first slash with dash
			.replace(/\(.*$/, ""); // Remove everything from opening parenthesis onwards

		// Find existing branch info file
		const files = await readdir(".cdtools");
		const branchInfoFile = files.find((file: string) => {
			console.log(`Checking file: ${file}`);
			const withoutExtension = file.replace(/\.json$/, "");
			const parts = withoutExtension.split("-");
			if (parts.length < 2) return false;

			// Extract branch name from filename (everything after first dash)
			const filenameBranch = parts.slice(1).join("-");
			console.log(
				`Comparing filename branch: ${filenameBranch} with normalized current branch: ${normalizedBranchName}`,
			);

			return filenameBranch === normalizedBranchName;
		});
		console.log(`Deleting branch info file: ${branchInfoFile}`);

		if (branchInfoFile) {
			const branchInfoPath = path.join(".cdtools", branchInfoFile);
			await unlink(branchInfoPath);
		}
	} catch (error) {
		throw new Error(
			`Failed to delete branch info: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
