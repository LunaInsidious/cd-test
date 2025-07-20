import path from "node:path";
import prompts from "prompts";
import {
	type BranchInfo,
	type BumpType,
	type Config,
	checkInitialized,
	loadBranchInfo,
	loadConfig,
	updateBranchInfo,
} from "../utils/config.js";
import {
	commitChanges,
	getChangedFiles,
	getCurrentBranch,
	pushChanges,
} from "../utils/git.js";
import {
	checkPrExists,
	createPullRequestInteractive,
} from "../utils/github.js";
import { updateMultipleProjectVersions } from "../utils/version-updater.js";

/**
 * Update versions and create/update PR
 *
 * This command:
 * 1. Checks if cd-tools has been initialized
 * 2. Checks if start-pr has been executed (branch info file exists)
 * 3. Prompts user to select version bump types (patch/minor/major)
 * 4. Calculates new versions based on versioningStrategy and bumpedVersions
 * 5. Updates version files (package.json, etc.)
 * 6. Creates branch info with workspaceUpdated field
 * 7. Commits and pushes changes
 * 8. Creates PR if it doesn't exist
 */
export async function pushPrCommand(): Promise<void> {
	console.log("🚀 Updating versions and creating PR...");

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

	// Select bump types based on versioning strategy
	const bumpSelections = await selectBumpTypes(config);
	if (!bumpSelections) {
		console.log("❌ Operation cancelled");
		process.exit(1);
	}

	console.log(bumpSelections);
	// Calculate new versions based on selections and current state
	const newVersions = await calculateNewVersions(
		config,
		branchInfo,
		bumpSelections,
	);
	console.log(newVersions);

	console.log("\n📋 Version updates:");
	for (const [projectPath, version] of Object.entries(newVersions)) {
		console.log(`  • ${projectPath}: ${version}`);
	}

	// Detect file changes since parent branch
	console.log("\n🔍 Detecting file changes...");
	const changedFiles = await getChangedFiles(branchInfo.parentBranch);

	// Determine which projects need updates based on file changes
	const projectsToUpdate = determineProjectsToUpdate(
		config,
		changedFiles,
		newVersions,
	);

	console.log("\n📂 Projects to update:");
	console.log(projectsToUpdate.length, projectsToUpdate);
	for (const projectPath of projectsToUpdate) {
		const newVersion = newVersions[projectPath];
		if (newVersion) {
			console.log(`  • ${projectPath}: ${newVersion}`);
		}
	}

	// Update version files for projects that need updates
	if (projectsToUpdate.length > 0) {
		console.log("\n📝 Updating version files...");
		const projectsToUpdateObjs = config.projects.filter((p) =>
			projectsToUpdate.includes(p.path),
		);
		const filteredVersions = Object.fromEntries(
			Object.entries(newVersions).filter(([path]) =>
				projectsToUpdate.includes(path),
			),
		);

		await updateMultipleProjectVersions(projectsToUpdateObjs, filteredVersions);

		// Update branch info with workspace updates
		await updateBranchInfo(currentBranch, filteredVersions);

		// Generate commit message
		const versionEntries = Object.entries(filteredVersions)
			.map(([path, version]) => `${path}(${version})`)
			.join(", ");
		const commitMessage = `commit for ${versionEntries}`;

		console.log(`\n📝 Committing changes: ${commitMessage}`);
		await commitChanges(commitMessage);

		console.log("📤 Pushing changes...");
		await pushChanges(currentBranch);

		// Create PR if it doesn't exist
		const prExists = await checkPrExists();
		if (!prExists) {
			console.log("\n🔄 Creating pull request...");
			const prTitle = `Release: ${versionEntries}`;
			const prBody = `Release PR for:\n\n${Object.entries(filteredVersions)
				.map(([path, version]) => `- ${path}: ${version}`)
				.join("\n")}`;

			const prUrl = await createPullRequestInteractive(
				prTitle,
				prBody,
				branchInfo.parentBranch,
			);
			console.log(`📋 Pull request created: ${prUrl}`);
		} else {
			console.log("\n📋 Pull request already exists, updated with new commits");
		}
	} else {
		console.log("\n✨ No projects need version updates");
	}

	console.log("✅ Push PR completed successfully!");
}

/**
 * Prompt user to select bump types for version updates
 * Returns null if cancelled, otherwise returns bump selections
 */
async function selectBumpTypes(
	config: Config,
): Promise<Record<string, BumpType> | null> {
	if (config.versioningStrategy === "fixed") {
		// For fixed strategy, all projects get the same bump type
		const { bumpType } = await prompts({
			type: "select",
			name: "bumpType",
			message: "Select version bump type for all projects:",
			choices: [
				{ title: "patch (1.0.0 → 1.0.1)", value: "patch" },
				{ title: "minor (1.0.0 → 1.1.0)", value: "minor" },
				{ title: "major (1.0.0 → 2.0.0)", value: "major" },
			],
		});

		if (!bumpType) {
			return null;
		}

		// Apply same bump type to all projects
		const result: Record<string, BumpType> = {};
		for (const project of config.projects) {
			result[project.path] = bumpType;
		}
		return result;
	} else {
		// For independent strategy, select per project
		const result: Record<string, BumpType> = {};

		for (const project of config.projects) {
			const { bumpType } = await prompts({
				type: "select",
				name: "bumpType",
				message: `Select version bump type for project '${project.path}':`,
				choices: [
					{ title: "skip (no changes)", value: "skip" },
					{ title: "patch (1.0.0 → 1.0.1)", value: "patch" },
					{ title: "minor (1.0.0 → 1.1.0)", value: "minor" },
					{ title: "major (1.0.0 → 2.0.0)", value: "major" },
				],
			});

			if (bumpType === undefined) {
				return null; // User cancelled
			}

			if (bumpType !== "skip") {
				result[project.path] = bumpType as BumpType;
			}
		}

		return result;
	}
}

/**
 * Calculate new versions based on bump selections and current project state
 */
async function calculateNewVersions(
	config: Config,
	branchInfo: BranchInfo,
	bumpSelections: Record<string, BumpType>,
): Promise<Record<string, string>> {
	const result: Record<string, string> = {};

	// Get the version tag configuration for the current release mode
	const currentVersionTag = getCurrentVersionTag(config, branchInfo.tag);
	if (!currentVersionTag) {
		throw new Error(
			`Version tag '${branchInfo.tag}' not found in configuration`,
		);
	}

	for (const project of config.projects) {
		const projectPath = project.path;
		const selectedBump = bumpSelections[projectPath];

		if (!selectedBump) {
			continue; // Project was skipped
		}

		// Check if this bump type or smaller has already been released
		const hasBeenReleased = hasVersionBumpBeenReleased(
			project.bumpedVersions,
			selectedBump,
		);

		let newVersion: string;
		if (hasBeenReleased) {
			// No base version change needed, just update suffix
			newVersion = generateVersionWithSuffix(
				project.baseVersion,
				branchInfo.tag,
				currentVersionTag.versionSuffixStrategy,
			);
		} else {
			// Calculate new base version and add to bumpedVersions
			const newBaseVersion = bumpVersion(project.baseVersion, selectedBump);
			newVersion = generateVersionWithSuffix(
				newBaseVersion,
				branchInfo.tag,
				currentVersionTag.versionSuffixStrategy,
			);
		}

		result[projectPath] = newVersion;
	}

	return result;
}

/**
 * Get version tag configuration for the specified tag name
 */
function getCurrentVersionTag(config: Config, tagName: string) {
	for (const versionTag of config.versionTags) {
		if (versionTag[tagName]) {
			return versionTag[tagName];
		}
	}
	return null;
}

/**
 * Check if a version bump type has already been released in this cycle
 */
function hasVersionBumpBeenReleased(
	bumpedVersions: BumpType[],
	selectedBump: BumpType,
): boolean {
	const bumpHierarchy = { patch: 0, minor: 1, major: 2 };
	const selectedLevel = bumpHierarchy[selectedBump];

	// Check if this level or higher has been bumped
	return bumpedVersions.some((bump) => bumpHierarchy[bump] >= selectedLevel);
}

/**
 * Bump a semantic version string
 * Handles both base versions (X.Y.Z) and pre-release versions (X.Y.Z-alpha.x)
 * Returns the new base version without any pre-release identifiers
 */
function bumpVersion(baseVersion: string, bumpType: BumpType): string {
	// Extract the base version part (before any pre-release identifier)
	const baseVersionPart = baseVersion.split("-")[0];
	if (!baseVersionPart) {
		throw new Error(`Invalid version format: ${baseVersion}`);
	}

	const parts = baseVersionPart.split(".").map(Number);
	if (parts.length !== 3 || parts.some(Number.isNaN)) {
		throw new Error(`Invalid version format, expected X.Y.Z: ${baseVersion}`);
	}

	const [majorPart, minorPart, patchPart] = parts;
	if (
		majorPart === undefined ||
		minorPart === undefined ||
		patchPart === undefined
	) {
		throw new Error(`Invalid version format: ${baseVersion}`);
	}

	let major = majorPart;
	let minor = minorPart;
	let patch = patchPart;

	switch (bumpType) {
		case "major":
			major += 1;
			minor = 0;
			patch = 0;
			break;
		case "minor":
			minor += 1;
			patch = 0;
			break;
		case "patch":
			patch += 1;
			break;
	}

	return `${major}.${minor}.${patch}`;
}

/**
 * Determine which projects need version updates based on file changes
 * Projects get updated if:
 * 1. They have files in their deps array that were changed
 * 2. For fixed strategy: if any project needs update, all projects get updated
 * 3. For independent strategy: only changed projects and their dependents get updated
 */
function determineProjectsToUpdate(
	config: Config,
	changedFiles: string[],
	newVersions: Record<string, string>,
): string[] {
	const projectsToUpdate = new Set<string>();
	const changedFullPaths = changedFiles.map((filepath) =>
		path.resolve(filepath),
	);

	// First pass: find directly affected projects
	for (const project of config.projects) {
		const projectPath = path.resolve(project.path);

		// Check if any of the project's dependency files were changed
		const hasChangedDeps = project.deps.some((depPath) => {
			// Deps are relative to the root directory
			const fullDepPath = path.resolve(depPath);
			return changedFullPaths.some(
				(changedPath) =>
					changedPath.startsWith(fullDepPath) || changedPath === fullDepPath,
			);
		});

		// Also check if any files within the project directory were changed
		const hasProjectChanges = changedFullPaths.some((changedPath) =>
			changedPath.startsWith(`${projectPath}/`),
		);

		if (hasChangedDeps || hasProjectChanges) {
			projectsToUpdate.add(project.path); // Keep original path format
		}
	}

	// For fixed strategy: if any project needs update, all projects with new versions get updated
	if (config.versioningStrategy === "fixed" && projectsToUpdate.size > 0) {
		for (const projectPath of Object.keys(newVersions)) {
			projectsToUpdate.add(projectPath);
		}
	}

	// TODO: Add dependency graph resolution for independent strategy
	// For now, independent strategy only updates directly affected projects

	return Array.from(projectsToUpdate);
}

/**
 * Generate version string with appropriate suffix
 */
function generateVersionWithSuffix(
	baseVersion: string,
	tag: string,
	strategy: "timestamp" | "increment",
): string {
	if (strategy === "timestamp") {
		const now = new Date();
		const timestamp = now
			.toISOString()
			.replace(/[-:T]/g, "")
			.replace(/\.\d{3}Z$/, "")
			.slice(0, 14); // YYYYMMDDhhmmss
		return `${baseVersion}-${tag}.${timestamp}`;
	} else {
		// increment strategy - would need to check existing tags
		// For now, start with .0 (this should be enhanced to check git tags)
		return `${baseVersion}-${tag}.0`;
	}
}

if (import.meta.vitest) {
	const { expect, it, describe } = import.meta.vitest;

	describe("bumpVersion", () => {
		it("should handle basic version bump", () => {
			expect(bumpVersion("1.0.0", "patch")).toBe("1.0.1");
			expect(bumpVersion("1.0.0", "minor")).toBe("1.1.0");
			expect(bumpVersion("1.0.0", "major")).toBe("2.0.0");
		});

		it("should handle pre-release base versions", () => {
			expect(bumpVersion("1.0.1-alpha.2", "patch")).toBe("1.0.2");
			expect(bumpVersion("2.1.0-beta.5", "minor")).toBe("2.2.0");
			expect(bumpVersion("1.5.3-rc.1", "major")).toBe("2.0.0");
		});

		it("should throw error for invalid versions", () => {
			expect(() => bumpVersion("invalid", "patch")).toThrow(
				"Invalid version format",
			);
			expect(() => bumpVersion("1.0", "patch")).toThrow(
				"Invalid version format",
			);
			expect(() => bumpVersion("1.0.x", "patch")).toThrow(
				"Invalid version format",
			);
		});
	});

	describe("hasVersionBumpBeenReleased", () => {
		it("should correctly check bump hierarchy", () => {
			expect(hasVersionBumpBeenReleased([], "patch")).toBe(false);
			expect(hasVersionBumpBeenReleased(["patch"], "patch")).toBe(true);
			expect(hasVersionBumpBeenReleased(["patch"], "minor")).toBe(false);
			expect(hasVersionBumpBeenReleased(["minor"], "patch")).toBe(true);
			expect(hasVersionBumpBeenReleased(["major"], "minor")).toBe(true);
		});
	});

	describe("generateVersionWithSuffix", () => {
		it("should generate timestamp versions", () => {
			const result = generateVersionWithSuffix("1.0.0", "alpha", "timestamp");
			expect(result).toMatch(/^1\.0\.0-alpha\.\d{14}$/);
		});

		it("should generate increment versions", () => {
			const result = generateVersionWithSuffix("1.0.0", "rc", "increment");
			expect(result).toBe("1.0.0-rc.0");
		});
	});

	describe("getCurrentVersionTag", () => {
		it("should find version tag configuration", () => {
			const config = {
				versioningStrategy: "fixed" as const,
				versionTags: [
					{ alpha: { versionSuffixStrategy: "timestamp" as const } },
					{ rc: { versionSuffixStrategy: "increment" as const } },
				],
				projects: [],
			};

			expect(getCurrentVersionTag(config, "alpha")).toEqual({
				versionSuffixStrategy: "timestamp",
			});
			expect(getCurrentVersionTag(config, "rc")).toEqual({
				versionSuffixStrategy: "increment",
			});
			expect(getCurrentVersionTag(config, "unknown")).toBe(null);
		});
	});

	describe("determineProjectsToUpdate", () => {
		it("should handle fixed strategy - all projects updated when any project has changes", () => {
			const config = {
				versioningStrategy: "fixed" as const,
				versionTags: [],
				projects: [
					{
						path: "package-a",
						deps: ["package-a/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
					{
						path: "package-b",
						deps: ["package-b/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			const changedFiles = ["package-a/src/index.ts"];
			const newVersions = { "package-a": "1.0.1", "package-b": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("package-a");
			expect(result).toContain("package-b");
		});

		it("should handle independent strategy - only affected projects updated", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "package-a",
						deps: ["package-a/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
					{
						path: "package-b",
						deps: ["package-b/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			const changedFiles = ["package-a/src/index.ts"];
			const newVersions = { "package-a": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("package-a");
			expect(result).not.toContain("package-b");
		});

		it("should detect changes in dependency files", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "package-a",
						deps: ["package-a/package.json", "package-a/Dockerfile"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			const changedFiles = ["package-a/Dockerfile"];
			const newVersions = { "package-a": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("package-a");
		});

		it("should not update projects with no changes", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "package-a",
						deps: ["package-a/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
					{
						path: "package-b",
						deps: ["package-b/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			const changedFiles = ["docs/README.md"];
			const newVersions = {};

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toHaveLength(0);
		});

		it("should handle relative paths correctly with path.resolve", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "./packages/package-a",
						deps: [
							"./packages/package-a/package.json",
							"./packages/package-a/src",
						],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
					{
						path: "packages/package-b",
						deps: ["packages/package-b/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			// Mix of relative and different formats
			const changedFiles = [
				"./packages/package-a/src/index.ts",
				"packages/package-a/package.json",
			];
			const newVersions = { "./packages/package-a": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("./packages/package-a");
			expect(result).not.toContain("packages/package-b");
		});

		it("should detect dependency files with various path formats", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "apps/frontend",
						deps: [
							"apps/frontend/package.json",
							"shared/config.json",
							"apps/frontend/Dockerfile",
						],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			// Test that shared/config.json change triggers update
			const changedFiles = ["shared/config.json"];
			const newVersions = { "apps/frontend": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("apps/frontend");
		});

		it("should handle exact file matches vs directory prefix matches", () => {
			const config = {
				versioningStrategy: "independent" as const,
				versionTags: [],
				projects: [
					{
						path: "packages/lib",
						deps: ["packages/lib/package.json", "packages/lib/build.config.js"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
					{
						path: "packages/lib-utils",
						deps: ["packages/lib-utils/package.json"],
						type: "npm",
						baseVersion: "1.0.0",
						bumpedVersions: [],
						registries: [],
					},
				],
			};
			// Change in packages/lib should not affect packages/lib-utils
			const changedFiles = ["packages/lib/src/index.ts"];
			const newVersions = { "packages/lib": "1.0.1" };

			const result = determineProjectsToUpdate(
				config,
				changedFiles,
				newVersions,
			);

			expect(result).toContain("packages/lib");
			expect(result).not.toContain("packages/lib-utils");
		});
	});
}
