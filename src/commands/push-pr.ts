import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config/parser.js";
import {
	readFileContent,
	updateCargoVersion,
	updatePackageVersion,
	writeFile,
} from "../fs/utils.js";
import { commitChanges, getChangedFiles, pushChanges } from "../git/operations.js";
import {
	checkExistingPR,
	createPullRequest,
	updatePullRequest,
	GitHubError,
} from "../git/github.js";
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

	// Handle GitHub PR creation/update
	try {
		const existingPR = await checkExistingPR();
		
		const prTitle = `Release ${newVersion}`;
		const prBody = generatePRBody(newVersion, affectedProjects, trackingData.tag);

		if (existingPR) {
			console.log(`🔄 Updating existing PR: ${existingPR}`);
			await updatePullRequest(prTitle, prBody);
			console.log(`✅ Updated PR: ${existingPR}`);
		} else {
			const createPR = await askYesNo("Create GitHub PR?", true);
			if (createPR) {
				console.log("🔗 Creating GitHub PR...");
				const prUrl = await createPullRequest(prTitle, prBody);
				console.log(`✅ Created PR: ${prUrl}`);
			}
		}
	} catch (error) {
		if (error instanceof GitHubError) {
			console.error(`❌ GitHub CLI error: ${error.message}`);
			console.log("💡 You can create the PR manually or fix the GitHub CLI setup");
		} else {
			throw error;
		}
	}

	console.log("✅ Push PR completed successfully!");
}

function generatePRBody(
	version: string,
	affectedProjects: Array<{ path: string; type: string; registries: string[] }>,
	tag: string,
): string {
	const projectList = affectedProjects
		.map((p) => `- **${p.path}** (${p.type}) → ${version}`)
		.join("\n");

	return `## Release ${version}

### Changes
This PR updates project versions to \`${version}\` with tag \`${tag}\`.

### Updated Projects
${projectList}

### Release Process
1. ✅ Version numbers updated
2. ⏳ CI checks must pass
3. ⏳ Ready for merge with \`cd-tools end-pr\`

### Registry Deployments
After merge, the following registries will be updated:
${affectedProjects
	.flatMap((p) => p.registries)
	.filter((r, i, arr) => arr.indexOf(r) === i)
	.map((registry) => `- ${registry}`)
	.join("\n")}

---
*This PR was created automatically by cd-tools*`;
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