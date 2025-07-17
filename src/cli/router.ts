import type { ParsedArgs } from "./parser.js";

export interface CommandHandler {
	name: string;
	description: string;
	subcommands?: SubcommandHandler[];
	handler: (args: ParsedArgs) => Promise<void> | void;
}

export interface SubcommandHandler {
	name: string;
	description: string;
	handler: (args: ParsedArgs) => Promise<void> | void;
}

export class CommandRouter {
	private commands = new Map<string, CommandHandler>();

	register(command: CommandHandler): void {
		this.commands.set(command.name, command);
	}

	async execute(args: ParsedArgs): Promise<void> {
		const command = this.commands.get(args.command);
		if (!command) {
			throw new Error(`Unknown command: ${args.command}`);
		}

		// Handle subcommands
		if (args.subcommand && command.subcommands) {
			const subcommand = command.subcommands.find(
				(sub) => sub.name === args.subcommand,
			);
			if (!subcommand) {
				throw new Error(
					`Unknown subcommand: ${args.subcommand} for command: ${args.command}`,
				);
			}
			await subcommand.handler(args);
			return;
		}

		// Execute main command
		await command.handler(args);
	}

	getAvailableCommands(): string[] {
		return Array.from(this.commands.keys());
	}

	getCommandDescription(commandName: string): string | undefined {
		return this.commands.get(commandName)?.description;
	}

	getAvailableSubcommands(commandName: string): string[] {
		const command = this.commands.get(commandName);
		return command?.subcommands?.map((sub) => sub.name) ?? [];
	}

	generateHelp(): string {
		const lines: string[] = [];
		lines.push("Available commands:");
		lines.push("");

		for (const [name, command] of this.commands) {
			lines.push(`  ${name.padEnd(12)} ${command.description}`);

			if (command.subcommands) {
				for (const subcommand of command.subcommands) {
					lines.push(`    ${subcommand.name.padEnd(10)} ${subcommand.description}`);
				}
			}
		}

		return lines.join("\n");
	}
}