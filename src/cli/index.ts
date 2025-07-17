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
		throw error;
	}
}

function createRouter(): CommandRouter {
	const router = new CommandRouter();

	// Register placeholder commands - will be implemented later
	router.register({
		name: "init",
		description:
			"Initialize project with GitHub workflows and default configuration",
		handler: async (args) => {
			console.log("Init command called with:", args);
			console.log("This command will be implemented in the next phase");
		},
	});

	router.register({
		name: "start-pr",
		description: "Start a release PR with version selection",
		handler: async (args) => {
			console.log("Start-PR command called with:", args);
			console.log("This command will be implemented in the next phase");
		},
	});

	router.register({
		name: "push-pr",
		description: "Update versions and create/update PR",
		handler: async (args) => {
			console.log("Push-PR command called with:", args);
			console.log("This command will be implemented in the next phase");
		},
	});

	router.register({
		name: "end-pr",
		description: "Finalize release and merge PR",
		handler: async (args) => {
			console.log("End-PR command called with:", args);
			console.log("This command will be implemented in the next phase");
		},
	});

	return router;
}
