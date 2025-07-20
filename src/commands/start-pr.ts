import prompts from "prompts";
import {
	type Config,
	checkInitialized,
	createBranchInfo,
	getAvailableVersionTags,
	loadConfig,
} from "../utils/config.js";
import {
	createAndCheckoutBranch,
	getCurrentBranch,
	pullLatest,
	validateBranchName,
} from "../utils/git.js";

/**
 * Start a new release PR
 *
 * This command:
 * 1. Checks if cd-tools has been initialized
 * 2. Pulls latest changes from current branch
 * 3. Prompts user to select release mode from available version tags
 * 4. Prompts user to input new branch name
 * 5. Creates and checks out new branch with format: [branchName]([releaseMode])
 * 6. Creates branch tracking file with format: [releaseMode]-[escapedBranchName].json
 */
export async function startPrCommand(): Promise<void> {
	console.log("🚀 Starting new release PR...");

	// Check if cd-tools has been initialized
	const isInitialized = await checkInitialized();
	if (!isInitialized) {
		console.error(
			"❌ cd-tools has not been initialized. Run 'cd-tools init' first.",
		);
		process.exit(1);
	}

	// Get current branch for pulling latest changes
	const currentBranch = await getCurrentBranch();
	console.log(`📂 Current branch: ${currentBranch}`);

	// Pull latest changes
	console.log("🔄 Pulling latest changes...");
	try {
		await pullLatest(currentBranch);
		console.log("✅ Successfully pulled latest changes");
	} catch (error) {
		console.error(
			`❌ Failed to pull latest changes: ${error instanceof Error ? error.message : String(error)}`,
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

	// Get available version tags
	const availableTags = getAvailableVersionTags(config);
	if (availableTags.length === 0) {
		console.error("❌ No version tags found in configuration.");
		process.exit(1);
	}

	// Prompt for release mode selection
	const { releaseMode } = await prompts({
		type: "select",
		name: "releaseMode",
		message: "Select release mode:",
		choices: availableTags,
	});

	if (!releaseMode) {
		console.log("❌ No release mode selected. Operation cancelled.");
		return;
	}

	console.log(`🏷️  Selected release mode: ${releaseMode}`);

	// Prompt for branch name
	const { branchName } = await prompts({
		type: "text",
		name: "branchName",
		message: "Enter new branch name:",
		validate: async (value: string) => {
			if (!value.trim()) {
				return "Branch name cannot be empty";
			}

			// Create full branch name to validate
			const fullBranchName = `${value}(${releaseMode})`;
			try {
				await validateBranchName(fullBranchName);
				return true;
			} catch (error) {
				return `Invalid branch name: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});

	if (!branchName) {
		console.log("❌ No branch name entered. Operation cancelled.");
		return;
	}

	// Create full branch name with release mode suffix
	const fullBranchName = `${branchName}(${releaseMode})`;
	console.log(`🌿 Creating branch: ${fullBranchName}`);

	// Create and checkout new branch
	try {
		await createAndCheckoutBranch(fullBranchName);
		console.log(
			`✅ Successfully created and checked out branch: ${fullBranchName}`,
		);
	} catch (error) {
		console.error(
			`❌ Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}

	// Create branch tracking file
	try {
		await createBranchInfo(releaseMode, branchName, currentBranch);
		console.log(`📝 Created branch tracking file for ${releaseMode} release`);
	} catch (error) {
		console.error(
			`❌ Failed to create branch tracking file: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}

	console.log("✅ Release PR started successfully!");
	console.log("");
	console.log("Next steps:");
	console.log("1. Make your changes");
	console.log("2. Run 'cd-tools push-pr' to update versions and create PR");
}
