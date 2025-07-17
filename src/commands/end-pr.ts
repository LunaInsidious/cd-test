import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/parser.js";
import { readFileContent, writeFile } from "../fs/utils.js";
import { commitChanges, pushChanges } from "../git/operations.js";
import { askYesNo } from "../interactive/prompts.js";
import { calculateVersion } from "../version/calculator.js";

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

		// Merge PR suggestion
		console.log("📋 To complete the release:");
		console.log("1. Ensure CI passes");
		console.log("2. Run: gh pr merge --squash");
		console.log("3. Create GitHub release if needed");
	}

	console.log("✅ End PR completed successfully!");
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
	project: { path: string; type: string },
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
