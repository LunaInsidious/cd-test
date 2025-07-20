import { access, readFile, writeFile } from "node:fs/promises";

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
	bumpedVersions: BumpType[];
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
	workspaceUpdated?: Record<string, string>;
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
		await writeFile(filename, JSON.stringify(branchInfo, null, "\t"));
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
 * Update branch info file with workspace updates
 */
export async function updateBranchInfo(
	currentBranch: string,
	workspaceUpdated: Record<string, string>,
): Promise<void> {
	const branchInfo = await loadBranchInfo(currentBranch);
	if (!branchInfo) {
		throw new Error("Branch info file not found");
	}

	// Create new branch info object to avoid mutation
	const updatedBranchInfo: BranchInfo = {
		...branchInfo,
		workspaceUpdated,
	};

	const parsed = parseBranchName(currentBranch);
	if (!parsed) {
		throw new Error("Invalid branch name format");
	}

	const escapedBranchName = escapeBranchNameForFilename(parsed.branchName);
	const filename = `.cdtools/${parsed.tag}-${escapedBranchName}.json`;

	try {
		await writeFile(filename, JSON.stringify(updatedBranchInfo, null, "\t"));
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

	for (const versionTag of config.versionTags) {
		for (const tagName of Object.keys(versionTag)) {
			tags.push({ title: tagName, value: tagName });
		}
	}

	return tags;
}
