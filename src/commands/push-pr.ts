import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/parser.js";
import {
	readFileContent,
	updateCargoVersion,
	updatePackageVersion,
	writeFile,
} from "../fs/utils.js";
import {
	commitChanges,
	getChangedFiles,
	pushChanges,
} from "../git/operations.js";
import { askYesNo } from "../interactive/prompts.js";
import { calculateNextVersion } from "../version/calculator.js";

export async function pushPrCommand(): Promise<void> {
	console.log("🔄 Updating versions and preparing PR...");

	// Load configuration
	const config = await loadConfig();

	// Find tracking file
	const trackingFile = await findTrackingFile();
	if (!trackingFile) {
		console.error("❌ No tracking file found. Run 'cd-tools start-pr' first.");
		return;
	}

	const trackingData = JSON.parse(await readFileContent(trackingFile)) as {
		tag: string;
		branch: string;
		baseVersion: string;
		currentVersion: string;
		releasedWorkspaces: Record<string, string>;
	};

	// Get changed files to determine which workspaces need releases
	const changedFiles = await getChangedFiles("main");
	const affectedProjects = getAffectedProjects(config.projects, changedFiles);

	console.log(`📂 Found ${affectedProjects.length} affected projects:`);
	for (const project of affectedProjects) {
		console.log(`  - ${project.path} (${project.type})`);
	}

	// Calculate new version
	const versionTagConfig = config.versionTags.find(
		(tag) => Object.keys(tag)[0] === trackingData.tag,
	);
	if (!versionTagConfig) {
		throw new Error(`Version tag configuration not found: ${trackingData.tag}`);
	}

	const tagConfig =
		versionTagConfig[trackingData.tag as keyof typeof versionTagConfig];
	if (
		!tagConfig ||
		typeof tagConfig !== "object" ||
		!("versionSuffixStrategy" in tagConfig)
	) {
		throw new Error(`Invalid tag configuration for: ${trackingData.tag}`);
	}

	const newVersion = calculateNextVersion(
		config.baseVersion,
		trackingData.tag,
		tagConfig.versionSuffixStrategy,
		trackingData.currentVersion,
	);

	console.log(`🏷️  New version: ${newVersion}`);

	// Update project versions
	for (const project of affectedProjects) {
		await updateProjectVersion(project, newVersion);
		trackingData.releasedWorkspaces[project.path] = newVersion;
		console.log(`✅ Updated ${project.path} to ${newVersion}`);
	}

	// Update tracking data
	trackingData.currentVersion = newVersion;
	await writeFile(trackingFile, JSON.stringify(trackingData, null, 2));

	// Commit and push changes
	const commitMessage = `chore: release ${newVersion}\n\nUpdated versions for:\n${affectedProjects.map((p) => `- ${p.path}`).join("\n")}`;
	await commitChanges(commitMessage);
	await pushChanges();

	// Create PR if it doesn't exist
	const createPR = await askYesNo("Create GitHub PR?", true);
	if (createPR) {
		console.log("🔗 Creating GitHub PR...");
		// Implementation would use GitHub CLI to create PR
		console.log(
			"Run: gh pr create --title 'Release ${newVersion}' --body 'Automated release PR'",
		);
	}

	console.log("✅ Push PR completed successfully!");
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

function getAffectedProjects(
	projects: Array<{ path: string; type: string; registries: string[] }>,
	changedFiles: string[],
): Array<{ path: string; type: string; registries: string[] }> {
	return projects.filter((project) => {
		return changedFiles.some((file) =>
			file.startsWith(project.path.replace("./", "")),
		);
	});
}

async function updateProjectVersion(
	project: { path: string; type: string },
	newVersion: string,
): Promise<void> {
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
