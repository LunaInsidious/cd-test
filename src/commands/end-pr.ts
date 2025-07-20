import {
	type BranchInfo,
	type Config,
	checkInitialized,
	deleteBranchInfo,
	getVersionTagConfig,
	isStableTag,
	loadBranchInfo,
	loadConfig,
} from "../utils/config.js";
import {
	commitChanges,
	deleteLocalBranch,
	getCurrentBranch,
	getTagsMatchingPattern,
	pushChanges,
	switchToBranch,
} from "../utils/git.js";
import {
	checkPrExists,
	getCurrentPrUrl,
	mergePullRequest,
} from "../utils/github.js";

/**
 * Finalize and merge PR
 *
 * This command:
 * 1. Checks if cd-tools has been initialized
 * 2. Checks if start-pr has been executed (branch info file exists)
 * 3. Checks if PR has been created
 * 4. Updates versions according to 'next' tag configuration
 * 5. Commits and pushes final version changes
 * 6. Deletes branch info file and pushes cleanup
 * 7. Merges the PR with squash
 */
export async function endPrCommand(): Promise<void> {
	console.log("🏁 Finalizing and merging PR...");

	// Check if cd-tools has been initialized
	const isInitialized = await checkInitialized();
	if (!isInitialized) {
		console.error(
			"❌ cd-tools has not been initialized. Run 'cd-tools init' first.",
		);
		process.exit(1);
	}

	// Load configuration
	let config: Config;
	try {
		config = await loadConfig();
	} catch (error) {
		console.error(
			`❌ Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}

	// Get current branch to find branch info file
	const currentBranch = await getCurrentBranch();
	console.log(`📂 Current branch: ${currentBranch}`);

	// Check if start-pr has been executed by finding branch info file
	const branchInfo = await loadBranchInfo(currentBranch);
	if (!branchInfo) {
		console.error("❌ No branch info found. Run 'cd-tools start-pr' first.");
		process.exit(1);
	}

	console.log(`🏷️  Release mode: ${branchInfo.tag}`);
	console.log(`📁 Parent branch: ${branchInfo.parentBranch}`);

	// Check if PR has been created
	const prExists = await checkPrExists();
	if (!prExists) {
		console.error("❌ No pull request found. Run 'cd-tools push-pr' first.");
		process.exit(1);
	}

	const prUrl = await getCurrentPrUrl();
	if (!prUrl) {
		console.error("❌ Could not get pull request URL.");
		process.exit(1);
	}
	console.log(`📋 Pull request URL: ${prUrl}`);

	// Get the current version tag configuration
	const currentVersionTag = getVersionTagConfig(config, branchInfo.tag);
	if (!currentVersionTag) {
		throw new Error(
			`Version tag '${branchInfo.tag}' not found in configuration`,
		);
	}

	// // Check if this is a stable release
	// const isStableRelease = isStableTag(config, branchInfo.tag);

	// if (isStableRelease) {
	// 	// For stable releases, update baseVersion in config.json with current workspaceUpdated
	// 	if (
	// 		branchInfo.workspaceUpdated &&
	// 		Object.keys(branchInfo.workspaceUpdated).length > 0
	// 	) {
	// 		console.log("📝 Updating baseVersion for stable release...");

	// 		// Update project baseVersions to the released stable versions
	// 		const updatedConfig = { ...config };
	// 		for (const project of updatedConfig.projects) {
	// 			const stableVersion = branchInfo.workspaceUpdated[project.path];
	// 			if (stableVersion) {
	// 				project.baseVersion = stableVersion;
	// 			}
	// 		}

	// 		// Save updated config
	// 		await updateConfig(updatedConfig);

	// 		console.log("\n📋 Updated baseVersions:");
	// 		for (const [projectPath, version] of Object.entries(
	// 			branchInfo.workspaceUpdated,
	// 		)) {
	// 			console.log(`  • ${projectPath}: ${version}`);
	// 		}

	// 		// Commit config changes using package names
	// 		const versionEntries = [];
	// 		for (const [path, version] of Object.entries(
	// 			branchInfo.workspaceUpdated,
	// 		)) {
	// 			try {
	// 				const packageName = await getPackageName(path);
	// 				versionEntries.push(`${packageName}(${version})`);
	// 			} catch {
	// 				// Fallback to path if package name is not available
	// 				versionEntries.push(`${path}(${version})`);
	// 			}
	// 		}
	// 		const commitMessage = `update baseVersion for stable release: ${versionEntries.join(", ")}`;

	// 		console.log(`\n📝 Committing baseVersion updates: ${commitMessage}`);
	// 		await commitChanges(commitMessage);

	// 		console.log("📤 Pushing baseVersion updates...");
	// 		await pushChanges(currentBranch);
	// 	}
	// }

	// // Get the next version tag configuration
	// const nextTag = currentVersionTag.next;
	// if (!nextTag) {
	// 	console.log("✨ No next version configured, skipping version updates");
	// } else {
	// 	console.log(`📈 Updating to next version tag: ${nextTag}`);

	// 	const nextVersionTag = getVersionTagConfig(config, nextTag);
	// 	if (!nextVersionTag) {
	// 		throw new Error(
	// 			`Next version tag '${nextTag}' not found in configuration`,
	// 		);
	// 	}

	// 	// Calculate new versions for next tag
	// 	const newVersions = await calculateNextVersions(
	// 		config,
	// 		branchInfo,
	// 		nextTag,
	// 		nextVersionTag.versionSuffixStrategy,
	// 	);

	// 	if (Object.keys(newVersions).length > 0) {
	// 		console.log("\n📋 Next version updates:");
	// 		for (const [projectPath, version] of Object.entries(newVersions)) {
	// 			const packageName = await getPackageName(projectPath);
	// 			console.log(`  • ${packageName}: ${version}`);
	// 		}

	// 		// Update version files
	// 		console.log("\n📝 Updating version files for next release...");
	// 		const projectsToUpdate = config.projects.filter(
	// 			(p) => newVersions[p.path] !== undefined,
	// 		);

	// 		await updateMultipleProjectVersions(projectsToUpdate, newVersions);

	// 		// Generate commit message using package names
	// 		const versionEntries = [];
	// 		for (const [path, version] of Object.entries(newVersions)) {
	// 			try {
	// 				const packageName = await getPackageName(path);
	// 				versionEntries.push(`${packageName}(${version})`);
	// 			} catch {
	// 				// Fallback to path if package name is not available
	// 				versionEntries.push(`${path}(${version})`);
	// 			}
	// 		}
	// 		const commitMessage = `prepare next release: ${versionEntries.join(", ")}`;

	// 		console.log(`\n📝 Committing next version changes: ${commitMessage}`);
	// 		await commitChanges(commitMessage);

	// 		console.log("📤 Pushing next version changes...");
	// 		await pushChanges(currentBranch);
	// 	}
	// }

	// Clean up branch info file
	console.log("\n🧹 Cleaning up branch info file...");
	await deleteBranchInfo(currentBranch);

	console.log("📝 Committing cleanup...");
	await commitChanges("cleanup: remove branch info file");

	console.log("📤 Pushing cleanup...");
	await pushChanges(currentBranch);

	// Merge the PR
	console.log("\n🔀 Merging pull request...");
	await mergePullRequest(prUrl);

	// Switch back to parent branch and delete the feature branch
	console.log(`\n🔄 Switching back to ${branchInfo.parentBranch} branch...`);
	await switchToBranch(branchInfo.parentBranch);

	console.log(`🗑️  Deleting local branch: ${currentBranch}`);
	try {
		await deleteLocalBranch(currentBranch);
		console.log(`✅ Local branch '${currentBranch}' deleted successfully`);
	} catch (error) {
		console.warn(
			`⚠️  Failed to delete local branch '${currentBranch}': ${error instanceof Error ? error.message : String(error)}`,
		);
		console.warn(
			`You may need to delete it manually with: git branch -d ${currentBranch}`,
		);
	}

	console.log("✅ End PR completed successfully!");
}

/**
 * Get version tag configuration for the specified tag name
 */

/**
 * Calculate new versions for the next release tag
 */
async function calculateNextVersions(
	config: Config,
	branchInfo: BranchInfo,
	nextTag: string,
	versionSuffixStrategy: "timestamp" | "increment",
): Promise<Record<string, string>> {
	const result: Record<string, string> = {};

	// Only update projects that were updated in this PR
	if (!branchInfo.workspaceUpdated) {
		return result;
	}

	// Check if the next tag is a stable release
	const isNextStableRelease = isStableTag(config, nextTag);

	for (const [projectPath] of Object.entries(branchInfo.workspaceUpdated)) {
		const project = config.projects.find((p) => p.path === projectPath);
		if (!project) {
			console.warn(`Warning: Project ${projectPath} not found in config`);
			continue;
		}

		let newVersion: string;
		if (isNextStableRelease) {
			// For stable releases, no suffix - use the current workspace version without suffix
			const currentWorkspaceVersion = branchInfo.workspaceUpdated[projectPath];
			if (currentWorkspaceVersion) {
				// Remove suffix from current version (e.g., "1.1.0-rc.0" -> "1.1.0")
				const versionParts = currentWorkspaceVersion.split("-");
				newVersion = versionParts[0] || currentWorkspaceVersion;
			} else {
				// Fallback to base version if no workspace version exists
				newVersion = project.baseVersion;
			}
		} else {
			// For non-stable releases, generate version with suffix
			newVersion = await generateVersionWithSuffix(
				project.baseVersion,
				nextTag,
				versionSuffixStrategy,
			);
		}

		result[projectPath] = newVersion;
	}

	return result;
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
 * Generate version string with appropriate suffix
 * @param baseVersion - The base version (e.g., "1.0.0")
 * @param tag - The version tag (e.g., "alpha", "rc")
 * @param strategy - The suffix strategy ("timestamp" or "increment")
 * @returns Promise resolving to the versioned string
 */
async function generateVersionWithSuffix(
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
	} catch (error) {
		// If git tag lookup fails, default to 0
		console.warn(
			`Warning: Could not check existing tags for ${baseVersion}-${tag}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return 0;
	}
}

if (import.meta.vitest) {
	const { expect, it, describe, vi } = import.meta.vitest;

	describe("getVersionTagConfig", () => {
		it("should find version tag configuration", () => {
			const config = {
				versioningStrategy: "fixed" as const,
				versionTags: [
					{
						alpha: {
							versionSuffixStrategy: "timestamp" as const,
							next: "rc",
						},
					},
					{
						rc: {
							versionSuffixStrategy: "increment" as const,
							next: "stable",
						},
					},
				],
				projects: [],
			};

			expect(getVersionTagConfig(config, "alpha")).toEqual({
				versionSuffixStrategy: "timestamp",
				next: "rc",
			});
			expect(getVersionTagConfig(config, "rc")).toEqual({
				versionSuffixStrategy: "increment",
				next: "stable",
			});
			expect(getVersionTagConfig(config, "unknown")).toBe(null);
		});
	});

	describe("calculateNextVersions", () => {
		it("should calculate next versions for updated workspaces", async () => {
			const config = {
				versioningStrategy: "fixed" as const,
				versionTags: [],
				projects: [
					{
						path: "package-a",
						type: "npm" as const,
						baseVersion: "1.0.0",
						deps: [],
						registries: [],
					},
					{
						path: "package-b",
						type: "npm" as const,
						baseVersion: "2.1.0",
						deps: [],
						registries: [],
					},
				],
			};

			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"package-a": "1.0.1-alpha.20231225103045",
					"package-b": "2.1.1-alpha.20231225103045",
				},
			};

			// Mock Date for predictable timestamp
			const mockDate = new Date("2023-12-25T10:30:45.123Z");
			vi.setSystemTime(mockDate);

			const result = await calculateNextVersions(
				config,
				branchInfo,
				"rc",
				"timestamp",
			);

			expect(result).toEqual({
				"package-a": "1.0.0-rc.20231225103045",
				"package-b": "2.1.0-rc.20231225103045",
			});
		});

		it("should return empty object when no workspaces updated", async () => {
			const config = {
				versioningStrategy: "fixed" as const,
				versionTags: [],
				projects: [],
			};

			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
			};

			const result = await calculateNextVersions(
				config,
				branchInfo,
				"rc",
				"timestamp",
			);

			expect(result).toEqual({});
		});
	});

	describe("generateVersionWithSuffix", () => {
		it("should generate timestamp versions", async () => {
			const result = await generateVersionWithSuffix(
				"1.0.0",
				"rc",
				"timestamp",
			);
			expect(result).toMatch(/^1\.0\.0-rc\.\d{14}$/);
		});

		it("should generate increment versions", async () => {
			const result = await generateVersionWithSuffix(
				"1.0.0",
				"rc",
				"increment",
			);
			expect(result).toBe("1.0.0-rc.0");
		});
	});
}
