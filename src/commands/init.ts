import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import prompts from "prompts";

/**
 * Initialize cd-tools configuration and workflow files
 *
 * This command:
 * 1. Copies default config.json to .cdtools directory
 * 2. Prompts user to select target registries
 * 3. Copies appropriate workflow files based on selection
 */
export async function initCommand(): Promise<void> {
	console.log("🚀 Initializing CD tools configuration...");

	// Ensure .cdtools directory exists
	try {
		await mkdir(".cdtools", { recursive: true });
	} catch (error) {
		console.error("❌ Failed to create .cdtools directory:", error);
		process.exit(1);
	}

	// Copy default config.json
	const defaultConfigPath = join(
		dirname(dirname(import.meta.dirname)),
		"default-files",
		"config.json",
	);
	const targetConfigPath = ".cdtools/config.json";

	try {
		// Check if config already exists
		try {
			await access(targetConfigPath);
			const { overwrite } = await prompts({
				type: "confirm",
				name: "overwrite",
				message: ".cdtools/config.json already exists. Overwrite?",
				initial: false,
			});

			if (!overwrite) {
				console.log("❌ Initialization cancelled");
				return;
			}
		} catch {
			// File doesn't exist, continue
		}

		await copyFile(defaultConfigPath, targetConfigPath);
		console.log("✅ Copied default configuration");
	} catch (error) {
		console.error("❌ Failed to copy config.json:", error);
		process.exit(1);
	}

	// Prompt for registry selection
	console.log("Please select the registry you plan to release.");

	const { registries } = await prompts({
		type: "multiselect",
		name: "registries",
		message: "Select target registries:",
		choices: [
			{ title: "npm", value: "npm" },
			{ title: "docker hub (ghcr.io)", value: "docker" },
		],
		min: 1,
	});

	if (!registries || registries.length === 0) {
		console.log("❌ No registries selected. Initialization cancelled.");
		return;
	}

	// Copy workflow files based on selection
	const defaultFilesDir = join(
		dirname(dirname(import.meta.dirname)),
		"default-files",
	);

	for (const registry of registries) {
		try {
			let sourceFile: string;
			let targetFile: string;

			switch (registry) {
				case "npm":
					sourceFile = join(defaultFilesDir, "publish-npm.yml");
					targetFile = ".github/workflows/publish-npm.yml";
					break;
				case "docker":
					sourceFile = join(defaultFilesDir, "publish-container-image.yml");
					targetFile = ".github/workflows/publish-container-image.yml";
					break;
				default:
					console.warn(`⚠️  Unknown registry: ${registry}`);
					continue;
			}

			await copyFile(sourceFile, targetFile);
			console.log(`✅ Copied workflow for ${registry}`);
		} catch (error) {
			console.error(`❌ Failed to copy workflow for ${registry}:`, error);
		}
	}

	console.log("🎉 CD tools initialization complete!");
}
