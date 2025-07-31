import {
	type BranchInfo,
	type Config,
	loadBranchInfo,
	loadConfig,
} from "../utils/config.js";
import { NotFoundError, ValidationError } from "../utils/error.js";
import { getTagsMatchingPattern } from "../utils/git.js";
import { getCurrentPrUrl } from "../utils/github.js";

/**
 * Ensure the configuration file exists and is valid
 * @returns Parsed Config object
 * Exits process with error message if loading fails
 */
export async function ensurePRInitConfig(): Promise<Config> {
	try {
		return await loadConfig();
	} catch (error) {
		if (error instanceof NotFoundError) {
			console.error(
				"❌ Configuration file not found. Run 'cd-tools init' first.",
			);
			process.exit(1);
		}
		if (error instanceof ValidationError) {
			console.error(`❌ Invalid configuration format: ${error.message}`);
			process.exit(1);
		}
		console.error(
			`❌ Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

/**
 * Ensure branch info file exists for the current branch
 * @param currentBranch - The current branch name
 * @returns Parsed BranchInfo object
 * Exits process with error message if loading fails
 */
export async function ensurePRStartBranchInfo(
	currentBranch: string,
): Promise<BranchInfo> {
	try {
		return await loadBranchInfo(currentBranch);
	} catch (error) {
		if (error instanceof NotFoundError) {
			console.error(
				`❌ Branch info not found for "${currentBranch}". Run "cd-tools start-pr" first.`,
			);
			process.exit(1);
		}
		if (error instanceof ValidationError) {
			console.error(`❌ Invalid branch information format: ${error.message}`);
			process.exit(1);
		}
		console.error(
			`❌ Failed to load branch information: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

export async function ensurePRExists(): Promise<string> {
	try {
		const prUrl = await getCurrentPrUrl();
		if (prUrl) return prUrl;
		console.error("❌ No pull request found. Run 'cd-tools push-pr' first.");
		process.exit(1);
	} catch (error) {
		console.error(
			`❌ Failed to check pull request: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}

/**
 * Escape special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegexMetaCharacters(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract increment numbers from existing tags
 * @param existingTags - Array of existing git tags
 * @param baseVersion - The base version to check
 * @param tag - The tag name to check
 * @returns Next increment number
 */
export function getNextIncrementFromTags(
	existingTags: string[],
	baseVersion: string,
	tag: string,
): number {
	// Create regex pattern to match version tags with increment numbers
	// Supports both formats: "1.0.0-alpha.0" and "library-name-1.0.0-alpha.0"
	const escapedBaseVersion = escapeRegexMetaCharacters(baseVersion);
	const escapedTag = escapeRegexMetaCharacters(tag);
	const incrementRegex = new RegExp(
		`^(?:.*-)?${escapedBaseVersion}-${escapedTag}\\.(\\d+)$`,
	);

	// Extract increment numbers from matching tags
	const increments = existingTags
		.map((tagName) => {
			const match = tagName.match(incrementRegex);
			return match?.[1] ? parseInt(match[1], 10) : -1;
		})
		.filter((num) => num >= 0);

	// Return next increment (highest + 1, or 0 if none exist)
	return increments.length > 0 ? Math.max(...increments) + 1 : 0;
}

/**
 * Generate version string with appropriate suffix
 * @param baseVersion - The base version (e.g., "1.0.0")
 * @param tag - The version tag (e.g., "alpha", "rc")
 * @param strategy - The suffix strategy ("timestamp" or "increment")
 * @returns Promise resolving to the versioned string
 */
export async function generateVersionWithSuffix(
	baseVersion: string,
	tag: string,
	strategy: "timestamp" | "increment",
): Promise<string> {
	if (strategy === "timestamp") {
		const now = new Date();
		const timestamp = now
			.toISOString()
			.replace(/[-:T]/g, "")
			.replace(/\.\d{3}Z$/, "")
			.slice(0, 14); // YYYYMMDDhhmmss
		return `${baseVersion}-${tag}.${timestamp}`;
	} else {
		// increment strategy - check existing tags to find the next increment
		const nextIncrement = await getNextIncrement(baseVersion, tag);
		return `${baseVersion}-${tag}.${nextIncrement}`;
	}
}

/**
 * Get the next increment number for a given base version and tag
 * Checks existing git tags to find the highest increment and returns next
 * @param baseVersion - The base version to check (e.g., "1.0.0")
 * @param tag - The tag name to check (e.g., "alpha", "rc")
 * @returns Promise resolving to the next increment number
 */
async function getNextIncrement(
	baseVersion: string,
	tag: string,
): Promise<number> {
	try {
		// Look for tags like "1.0.0-alpha.0", "1.0.0-alpha.1", "lib-1.0.0-alpha.0", etc.
		const tagPattern = `*${baseVersion}-${tag}.*`;
		const existingTags = await getTagsMatchingPattern(tagPattern);
		return getNextIncrementFromTags(existingTags, baseVersion, tag);
	} catch (error) {
		// If git tag lookup fails, default to 0
		console.warn(
			`Warning: Could not check existing tags for ${baseVersion}-${tag}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 0;
	}
}
