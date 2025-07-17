import { loadConfig } from "../config/parser.js";
import { calculateVersion } from "../version/calculator.js";
import { createBranch, getCurrentBranch, pullLatest } from "../git/operations.js";
import { askChoice, askInput } from "../interactive/prompts.js";
import { writeFile } from "../fs/utils.js";

export async function startPrCommand(): Promise<void> {
	console.log("🚀 Starting release PR...");

	// Load configuration
	const config = await loadConfig();

	// Pull latest changes
	console.log("📥 Pulling latest changes...");
	await pullLatest();

	// Select version tag
	const versionTags = config.versionTags.map((tag) => {
		const tagName = Object.keys(tag)[0];
		if (!tagName) throw new Error("Invalid version tag configuration");
		return { name: tagName, value: tagName };
	});

	const selectedTag = await askChoice(
		"Select version tag for this release:",
		versionTags,
	);

	// Get branch name
	const branchName = await askInput("Enter branch name", "feat/release");
	const fullBranchName = `rc:${branchName}`;

	// Calculate initial version
	const newVersion = calculateVersion(config.baseVersion, selectedTag, "increment");
	
	console.log(`🏷️  Target version: ${newVersion}`);

	// Create and checkout new branch
	console.log(`🌿 Creating branch: ${fullBranchName}`);
	await createBranch(fullBranchName);

	// Create tracking file
	const trackingFileName = `${selectedTag}_${branchName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
	const trackingData = {
		tag: selectedTag,
		branch: fullBranchName,
		baseVersion: config.baseVersion,
		currentVersion: newVersion,
		releasedWorkspaces: {},
		createdAt: new Date().toISOString(),
	};

	await writeFile(`.cdtools/${trackingFileName}`, JSON.stringify(trackingData, null, 2));
	console.log(`📝 Created tracking file: .cdtools/${trackingFileName}`);

	console.log("✅ Release PR started successfully!");
	console.log("Next steps:");
	console.log("1. Make your changes");
	console.log("2. Run 'cd-tools push-pr' to update versions and create PR");
}