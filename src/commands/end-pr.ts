import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/parser.js";
import type { Project } from "../config/schema.js";
import { readFileContent } from "../fs/utils.js";
import {
	GitHubError,
	createRelease,
	getPRStatus,
	mergePullRequest,
} from "../git/github.js";
import { commitChanges, pushChanges } from "../git/operations.js";
import { askChoice, askYesNo } from "../interactive/prompts.js";

export async function endPrCommand(): Promise<void> {
	console.log("🏁 Finalizing release and merging PR...");

	// Load configuration
	const config = await loadConfig();

	// Find tracking file
	const trackingFile = await findTrackingFile();
	if (!trackingFile) {
		console.error("❌ No tracking file found. Nothing to finalize.");
		return;
	}

	const trackingData = JSON.parse(await readFileContent(trackingFile)) as {
		tag: string;
		branch: string;
		baseVersion: string;
		currentVersion: string;
		releasedWorkspaces: Record<string, string>;
	};

	// Check if there's a "next" version to release
	const versionTagConfig = config.versionTags.find(
		(tag) => Object.keys(tag)[0] === trackingData.tag,
	);
	if (!versionTagConfig) {
		throw new Error(`Version tag configuration not found: ${trackingData.tag}`);
	}

	const tagConfig =
		versionTagConfig[trackingData.tag as keyof typeof versionTagConfig];
	if (!tagConfig || typeof tagConfig !== "object") {
		throw new Error(`Invalid tag configuration for: ${trackingData.tag}`);
	}

	let finalVersion = trackingData.currentVersion;

	// If there's a "next" version specified, create final release
	if ("next" in tagConfig && tagConfig.next === "stable") {
		finalVersion = config.baseVersion;
		console.log(`🎯 Creating stable release: ${finalVersion}`);

		// Update all released workspaces to stable version
		for (const [projectPath] of Object.entries(
			trackingData.releasedWorkspaces,
		)) {
			const project = config.projects.find((p) => p.path === projectPath);
			if (project) {
				await updateProjectVersion(project, finalVersion);
				console.log(`✅ Updated ${projectPath} to stable ${finalVersion}`);
			}
		}

		// Commit stable version changes
		const commitMessage = `chore: release stable ${finalVersion}\n\nFinal stable release from ${trackingData.currentVersion}`;
		await commitChanges(commitMessage);
		await pushChanges();

		console.log("🚀 Stable release deployed!");
	}

	// Check PR status before merging
	try {
		const prStatus = await getPRStatus();
		console.log(`📋 PR Status: ${prStatus.state}`);

		if (!prStatus.mergeable) {
			console.warn("⚠️  PR is not mergeable. Please resolve conflicts first.");
			return;
		}

		// Check CI status
		const failedChecks = prStatus.checks.filter(
			(check) => check.status === "FAILURE" || check.status === "ERROR",
		);
		if (failedChecks.length > 0) {
			console.warn("⚠️  Some CI checks are failing:");
			for (const check of failedChecks) {
				console.warn(`   - ${check.name}: ${check.status}`);
			}

			const proceedAnyway = await askYesNo(
				"Proceed with merge despite failing checks?",
				false,
			);
			if (!proceedAnyway) {
				console.log("❌ Merge cancelled. Fix CI issues and try again.");
				return;
			}
		}

		// Choose merge method
		const mergeMethod = await askChoice("Select merge method:", [
			{ name: "Squash and merge (recommended)", value: "squash" as const },
			{ name: "Create merge commit", value: "merge" as const },
			{ name: "Rebase and merge", value: "rebase" as const },
		]);

		// Merge the PR
		console.log(`🔀 Merging PR with ${mergeMethod} method...`);
		await mergePullRequest(mergeMethod);
		console.log("✅ PR merged successfully!");

		// Create GitHub release for stable versions
		if (finalVersion === config.baseVersion) {
			const createGitHubRelease = await askYesNo(
				"Create GitHub release?",
				true,
			);
			if (createGitHubRelease) {
				const releaseBody = generateReleaseNotes(
					finalVersion,
					Object.keys(trackingData.releasedWorkspaces),
				);

				const releaseUrl = await createRelease(
					`v${finalVersion}`,
					`Release ${finalVersion}`,
					releaseBody,
				);
				console.log(`✅ Created GitHub release: ${releaseUrl}`);
			}
		}
	} catch (error) {
		if (error instanceof GitHubError) {
			console.error(`❌ GitHub CLI error: ${error.message}`);
			console.log(
				"💡 You can merge the PR manually in the GitHub web interface",
			);
		} else {
			throw error;
		}
	}

	// Clean up tracking file
	const confirmCleanup = await askYesNo(
		"Delete tracking file and finalize release?",
		true,
	);
	if (confirmCleanup) {
		await unlink(trackingFile);
		await commitChanges("chore: cleanup release tracking file");
		await pushChanges();

		console.log("🧹 Cleaned up tracking file");
	}

	console.log("✅ End PR completed successfully!");
}

function generateReleaseNotes(
	version: string,
	releasedProjects: string[],
): string {
	return `## Release ${version}

### Updated Projects
${releasedProjects.map((project) => `- ${project}`).join("\n")}

### What Changed
This release includes updates to the above projects with version ${version}.

---
*This release was created automatically by cd-tools*`;
}

async function findTrackingFile(): Promise<string | null> {
	try {
		const files = await readdir(".cdtools");
		const trackingFile = files.find(
			(f) => f.includes("_") && f.endsWith(".json"),
		);
		return trackingFile ? `.cdtools/${trackingFile}` : null;
	} catch {
		return null;
	}
}

async function updateProjectVersion(
	project: Project,
	newVersion: string,
): Promise<void> {
	const { updatePackageVersion, updateCargoVersion } = await import(
		"../fs/utils.js"
	);

	switch (project.type) {
		case "typescript": {
			const packageJsonPath = join(project.path, "package.json");
			await updatePackageVersion(packageJsonPath, newVersion);
			break;
		}
		case "rust": {
			const cargoTomlPath = join(project.path, "Cargo.toml");
			await updateCargoVersion(cargoTomlPath, newVersion);
			break;
		}
		default:
			console.log(
				`⚠️  Unknown project type: ${project.type}, skipping version update`,
			);
	}
}
