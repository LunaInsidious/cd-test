export interface ParsedArgs {
	command: string;
	subcommand?: string;
	options: Record<string, string | boolean>;
	positional: string[];
}

export class CLIParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CLIParseError";
	}
}

export function parseArgs(args: string[]): ParsedArgs {
	if (args.length === 0) {
		throw new CLIParseError("No command provided");
	}

	const [command, ...rest] = args;
	const options: Record<string, string | boolean> = {};
	const positional: string[] = [];
	let subcommand: string | undefined;

	let i = 0;
	while (i < rest.length) {
		const arg = rest[i];

		// Handle long options (--option or --option=value)
		if (arg.startsWith("--")) {
			const equalIndex = arg.indexOf("=");
			if (equalIndex > -1) {
				const key = arg.slice(2, equalIndex);
				const value = arg.slice(equalIndex + 1);
				options[key] = value;
			} else {
				const key = arg.slice(2);
				// Check if next arg is a value or another option
				if (i + 1 < rest.length && !rest[i + 1].startsWith("-")) {
					options[key] = rest[i + 1];
					i++; // Skip next arg since we used it as value
				} else {
					options[key] = true; // Boolean flag
				}
			}
		}
		// Handle short options (-o or -o value)
		else if (arg.startsWith("-") && arg.length > 1) {
			const key = arg.slice(1);
			// Check if next arg is a value or another option
			if (i + 1 < rest.length && !rest[i + 1].startsWith("-")) {
				options[key] = rest[i + 1];
				i++; // Skip next arg since we used it as value
			} else {
				options[key] = true; // Boolean flag
			}
		}
		// First positional argument after command is subcommand
		else if (!subcommand) {
			subcommand = arg;
		}
		// Rest are positional arguments
		else {
			positional.push(arg);
		}

		i++;
	}

	return {
		command,
		subcommand,
		options,
		positional,
	};
}

export function validateCommand(
	parsedArgs: ParsedArgs,
	validCommands: string[],
): void {
	if (!validCommands.includes(parsedArgs.command)) {
		throw new CLIParseError(
			`Unknown command: ${parsedArgs.command}. Valid commands: ${validCommands.join(", ")}`,
		);
	}
}

export function validateSubcommand(
	parsedArgs: ParsedArgs,
	validSubcommands: string[],
): void {
	if (
		parsedArgs.subcommand &&
		!validSubcommands.includes(parsedArgs.subcommand)
	) {
		throw new CLIParseError(
			`Unknown subcommand: ${parsedArgs.subcommand}. Valid subcommands: ${validSubcommands.join(", ")}`,
		);
	}
}

export function hasOption(parsedArgs: ParsedArgs, option: string): boolean {
	return option in parsedArgs.options;
}

export function getOption(
	parsedArgs: ParsedArgs,
	option: string,
	defaultValue?: string,
): string | undefined {
	const value = parsedArgs.options[option];
	if (typeof value === "string") {
		return value;
	}
	return defaultValue;
}

export function getBooleanOption(
	parsedArgs: ParsedArgs,
	option: string,
	defaultValue = false,
): boolean {
	const value = parsedArgs.options[option];
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		return value.toLowerCase() === "true" || value === "1";
	}
	return defaultValue;
}
