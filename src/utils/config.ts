import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isSystemError, NotFoundError, ValidationError } from "./error.js";

export const LIB_DIR = ".cdtools";
export const CONFIG_PATH = `${LIB_DIR}/config.json`;

const constructBranchInfoPath = (
	releaseMode: string,
	branchName: string,
): string => {
	const escapedBranchName = escapeBranchNameForFilename(branchName);
	return path.join(LIB_DIR, `${releaseMode}-${escapedBranchName}.json`);
};

/**
 * Configuration and branch tracking file utilities
 */

// Zod schemas
const BumpTypeSchema = z.enum(["patch", "minor", "major"]);
export type BumpType = z.infer<typeof BumpTypeSchema>;

const RegistrySchema = z.enum(["npm", "crates", "docker"]);

const VersionSuffixStrategySchema = z.enum(["timestamp", "increment"]);

export const VersionTagValueSchema = z.object({
	versionSuffixStrategy: VersionSuffixStrategySchema,
	next: z.string().optional(),
});
type VersionTagValue = z.infer<typeof VersionTagValueSchema>;

const VersionTagSchema = z.record(z.string(), VersionTagValueSchema);

const ProjectTypeSchema = z.enum(["typescript", "rust"]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

const ProjectSchema = z.object({
	path: z.string(),
	type: ProjectTypeSchema,
	baseVersion: z.string(),
	deps: z.array(z.string()),
	registries: z.array(RegistrySchema),
});
export type Project = z.infer<typeof ProjectSchema>;

const ReleaseNotesSchema = z.object({
	enabled: z.boolean(),
	template: z.string(),
});

const ConfigSchema = z.object({
	versioningStrategy: z.enum(["fixed", "independent"]),
	versionTags: z.array(VersionTagSchema),
	projects: z.array(ProjectSchema),
	releaseNotes: ReleaseNotesSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

const BranchInfoSchema = z.object({
	tag: z.string(),
	parentBranch: z.string(),
	projectUpdated: z.record(z.string(), z.string()).optional(),
});
export type BranchInfo = z.infer<typeof BranchInfoSchema>;

/**
 * Check if cd-tools has been initialized
 */
export async function hasConfigFile(): Promise<boolean> {
	try {
		await access(CONFIG_PATH);
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
		const content = await readFile(CONFIG_PATH, "utf-8");
		const data = JSON.parse(content);
		return ConfigSchema.parse(data);
	} catch (error) {
		if (isSystemError(error) && error.code === "ENOENT") {
			throw new NotFoundError("Configuration file not found.");
		}
		if (error instanceof z.ZodError) {
			throw new ValidationError(
				`Invalid configuration format: ${error.message}`,
			);
		}
		throw new Error(
			`Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Escape branch name for use in filename
 * Replace characters that are not suitable for filenames
 */
function escapeBranchNameForFilename(branchName: string): string {
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
	const branchInfoPath = constructBranchInfoPath(releaseMode, branchName);

	const branchInfo: BranchInfo = {
		tag: releaseMode,
		parentBranch: parentBranch,
	};

	try {
		await writeFile(
			branchInfoPath,
			`${JSON.stringify(branchInfo, null, "\t")}\n`,
		);
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
function parseBranchName(fullBranchName: string): {
	branchName: string;
	tag: string;
} {
	const match = fullBranchName.match(/^(.+)\(([^)]+)\)$/);
	if (!match || !match[1] || !match[2]) {
		throw new Error("Invalid branch name format. Expected 'branchName(tag)'.");
	}
	return {
		branchName: match[1],
		tag: match[2],
	};
}

/**
 * Load branch info file for current branch
 * @param currentBranch - The current branch name
 * @return Parsed BranchInfo object or null if not found
 * @throws Error if branch info file invalid format
 */
export async function loadBranchInfo(
	currentBranch: string,
): Promise<BranchInfo> {
	try {
		const parsed = parseBranchName(currentBranch);
		const branchInfoPath = constructBranchInfoPath(
			parsed.tag,
			parsed.branchName,
		);
		const content = await readFile(branchInfoPath, "utf-8");
		const data = JSON.parse(content);
		return BranchInfoSchema.parse(data);
	} catch (error) {
		if (isSystemError(error) && error.code === "ENOENT") {
			throw new NotFoundError("Branch info file not found.");
		}
		if (error instanceof z.ZodError) {
			throw new ValidationError(`Invalid branch info format: ${error.message}`);
		}
		throw new Error(
			`Failed to load branch info: ${error instanceof Error ? error.message : String(error)}`,
		);
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

	const branchInfoPath = constructBranchInfoPath(parsed.tag, parsed.branchName);
	try {
		await writeFile(
			branchInfoPath,
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
): VersionTagValue | null {
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
 * Update config.json with new project configurations
 * @param config - The updated configuration object
 */
export async function updateConfig(config: Config): Promise<void> {
	try {
		await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, "\t")}\n`);
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
		const files = await readdir(LIB_DIR);
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
			const branchInfoPath = path.join(LIB_DIR, branchInfoFile);
			await unlink(branchInfoPath);
		}
	} catch (error) {
		throw new Error(
			`Failed to delete branch info: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
