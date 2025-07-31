import prompts from "prompts";
import {
	type BranchInfo,
	type Config,
	checkInitialized,
	deleteBranchInfo,
	getVersionTagConfig,
	isStableTag,
	loadBranchInfo,
	loadConfig,
	updateBranchInfo,
	updateConfig,
} from "../utils/config.js";
import {
	commitChanges,
	getCurrentBranch,
	getTagsMatchingPattern,
	pushChanges,
} from "../utils/git.js";
import {
	checkPrExists,
	getCurrentPrUrl,
	mergePullRequest,
} from "../utils/github.js";
import {
	getPackageName,
	updateMultipleProjectVersions,
} from "../utils/version-updater.js";

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

	const config = await ensurePRInitConfig();

	// Get current branch to find branch info file
	const currentBranch = await getCurrentBranch();
	console.log(`📂 Current branch: ${currentBranch}`);

	// Check if start-pr has been executed by finding branch info file
	const branchInfo = await ensurePRStartBranchInfo(currentBranch);

	console.log(`🏷️  Release mode: ${branchInfo.tag}`);
	console.log(`📁 Parent branch: ${branchInfo.parentBranch}`);

	const prUrl = await ensurePRExists();
	console.log(`📋 Pull request URL: ${prUrl}`);

	// 本当にマージするか確認を入れる
	const confirmMerge = await prompts({
		type: "confirm",
		name: "confirm",
		message: `Are you sure you want to merge the PR? (${prUrl})`,
		initial: true,
	});

	if (!confirmMerge.confirm) {
		console.log("❌ Merge cancelled.");
		return;
	}

	// Get the current version tag configuration
	const currentVersionTag = getVersionTagConfig(config, branchInfo.tag);
	if (!currentVersionTag) {
		throw new Error(
			`Version tag '${branchInfo.tag}' not found in configuration`,
		);
	}

	// Get the next version tag configuration
	const nextTag = currentVersionTag.next;
	if (!nextTag) {
		console.log("✨ No next version configured, skipping version updates");
	} else {
		// Check if this is a stable release
		const isStableRelease = isStableTag(nextTag);

		console.log(`📈 Updating to next version tag: ${nextTag}`);

		const nextVersionTag = getVersionTagConfig(config, nextTag);
		if (!nextVersionTag) {
			throw new Error(
				`Next version tag '${nextTag}' not found in configuration`,
			);
		}

		// Calculate new versions for next tag
		const newVersions = await calculateNextVersions(
			config,
			branchInfo,
			nextTag,
			nextVersionTag.versionSuffixStrategy,
		);

		if (Object.keys(newVersions).length > 0) {
			console.log("\n📋 Next version updates:");
			for (const [projectPath, version] of Object.entries(newVersions)) {
				const packageName = await getPackageName(projectPath);
				console.log(`  • ${packageName}: ${version}`);
			}

			// Update version files
			console.log("\n📝 Updating version files for next release...");
			const projectsToUpdate = config.projects.filter(
				(p) => newVersions[p.path] !== undefined,
			);

			if (isStableRelease) {
				// update config baseVersion for stable releases
				console.log("🔄 Updating baseVersion in config for stable release...");
				for (const project of projectsToUpdate) {
					const newBaseVersion = newVersions[project.path];
					if (!newBaseVersion) {
						throw new Error(
							`Project ${project.path} does not have a baseVersion defined`,
						);
					}
					const newConfig = {
						...config,
						projects: config.projects.map((p) =>
							p.path === project.path
								? { ...p, baseVersion: newBaseVersion }
								: p,
						),
					};
					await updateConfig(newConfig);
					console.log(
						`Updated baseVersion for ${project.baseVersion} to ${newBaseVersion}`,
					);
				}
			}

			await updateMultipleProjectVersions(projectsToUpdate, newVersions);

			// Update branch info with the new versions for next tag
			await updateBranchInfo(currentBranch, newVersions, nextTag);

			// Generate commit message using package names
			const versionEntries = [];
			for (const [path, version] of Object.entries(newVersions)) {
				try {
					const packageName = await getPackageName(path);
					versionEntries.push(`${packageName}(${version})`);
				} catch {
					// Fallback to path if package name is not available
					versionEntries.push(`${path}(${version})`);
				}
			}
			const commitMessage = `prepare next release: ${versionEntries.join(", ")}`;

			console.log(`\n📝 Committing next version changes: ${commitMessage}`);
			await commitChanges(commitMessage);

			console.log("📤 Pushing next version changes...");
			await pushChanges(currentBranch);
		}
		// This is a workaround for GitHub Actions not picking up changes immediately
		console.log("\n⏳ Waiting for changes to propagate...");
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

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
	if (!branchInfo.projectUpdated) {
		return result;
	}

	// Check if the next tag is a stable release
	const isNextStableRelease = isStableTag(nextTag);

	for (const [projectPath] of Object.entries(branchInfo.projectUpdated)) {
		const project = config.projects.find((p) => p.path === projectPath);
		if (!project) {
			console.warn(`Warning: Project ${projectPath} not found in config`);
			continue;
		}

		let newVersion: string;
		if (isNextStableRelease) {
			// For stable releases, no suffix - use the current workspace version without suffix
			const currentWorkspaceVersion = branchInfo.projectUpdated[projectPath];
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
						type: "typescript" as const,
						baseVersion: "1.0.0",
						deps: [],
						registries: [],
					},
					{
						path: "package-b",
						type: "typescript" as const,
						baseVersion: "2.1.0",
						deps: [],
						registries: [],
					},
				],
			};

			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				projectUpdated: {
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
}
