#!/usr/bin/env node

import { runCLI } from "./cli/index.js";

// Only run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runCLI(process.argv).catch((error) => {
		console.error("Unexpected error:", error);
		process.exit(1);
	});
}
