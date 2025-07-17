import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Config, configSchema } from "./schema.js";

export class ConfigParseError extends Error {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message);
		this.name = "ConfigParseError";
	}
}

export function parseConfig(configPath: string): Config {
	try {
		const configContent = readFileSync(configPath, "utf-8");
		const rawConfig = JSON.parse(configContent);
		return configSchema.parse(rawConfig);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new ConfigParseError(
				`Invalid JSON in config file: ${error.message}`,
				error,
			);
		}
		throw new ConfigParseError(
			`Failed to parse config: ${error instanceof Error ? error.message : String(error)}`,
			error instanceof Error ? error : undefined,
		);
	}
}

export function loadConfig(projectRoot: string = process.cwd()): Config {
	const configPath = join(projectRoot, ".cdtools", "config.json");
	return parseConfig(configPath);
}

export function validateConfig(config: unknown): Config {
	return configSchema.parse(config);
}
