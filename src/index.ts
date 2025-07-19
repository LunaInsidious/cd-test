#!/usr/bin/env node

/**
 * CD Tools CLI Entry Point
 *
 * Main command-line interface for cd-tools package.
 * Supports init, start-pr, push-pr, and end-pr commands.
 */

import { initCommand } from "./commands/init.js";
import { startPrCommand } from "./commands/start-pr.js";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	try {
		switch (command) {
			case "init":
				await initCommand();
				break;

			case "start-pr":
				await startPrCommand();
				break;

			case "push-pr":
				console.log("push-pr command not yet implemented");
				break;

			case "end-pr":
				console.log("end-pr command not yet implemented");
				break;

			case undefined:
				console.log("Usage: cd-tools <command>");
				console.log("");
				console.log("Commands:");
				console.log("  init      Initialize cd-tools configuration");
				console.log("  start-pr  Start a new release PR");
				console.log("  push-pr   Update versions and create/update PR");
				console.log("  end-pr    Finalize release and merge PR");
				break;

			default:
				console.error(`Unknown command: ${command}`);
				process.exit(1);
		}
	} catch (error) {
		console.error(
			"Error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
