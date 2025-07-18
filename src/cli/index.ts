import { endPrCommand } from "../commands/end-pr.js";
import { initCommand } from "../commands/init.js";
import { pushPrCommand } from "../commands/push-pr.js";
import { startPrCommand } from "../commands/start-pr.js";
import { closePrompts } from "../interactive/prompts.js";
import { CLIParseError, parseArgs } from "./parser.js";
import { CommandRouter } from "./router.js";

export * from "./parser.js";
export * from "./router.js";

export async function runCLI(argv: string[]): Promise<void> {
	try {
		// Remove 'node' and script name from argv
		const args = argv.slice(2);

		if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
			const router = createRouter();
			console.log(router.generateHelp());
			return;
		}

		const parsedArgs = parseArgs(args);
		const router = createRouter();
		await router.execute(parsedArgs);
	} catch (error) {
		if (error instanceof CLIParseError) {
			console.error(`Error: ${error.message}`);
			process.exit(1);
		}
		if (
			error instanceof Error &&
			error.message.startsWith("Unknown command:")
		) {
			console.error(`Error: ${error.message}`);
			process.exit(1);
		}
		throw error;
	} finally {
		// Always close prompts interface to prevent hanging
		closePrompts();
	}
}

function createRouter(): CommandRouter {
	const router = new CommandRouter();

	router.register({
		name: "init",
		description:
			"Initialize project with GitHub workflows and default configuration",
		handler: async () => {
			await initCommand();
		},
	});

	router.register({
		name: "start-pr",
		description: "Start a release PR with version selection",
		handler: async () => {
			await startPrCommand();
		},
	});

	router.register({
		name: "push-pr",
		description: "Update versions and create/update PR",
		handler: async () => {
			await pushPrCommand();
		},
	});

	router.register({
		name: "end-pr",
		description: "Finalize release and merge PR",
		handler: async () => {
			await endPrCommand();
		},
	});

	return router;
}
