import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "./parser.js";
import { CommandRouter } from "./router.js";

describe("Command Router", () => {
	let router: CommandRouter;
	const mockHandler = vi.fn();
	const mockSubHandler = vi.fn();

	beforeEach(() => {
		router = new CommandRouter();
		mockHandler.mockClear();
		mockSubHandler.mockClear();
	});

	describe("register", () => {
		it("should register a simple command", () => {
			router.register({
				name: "test",
				description: "Test command",
				handler: mockHandler,
			});

			expect(router.getAvailableCommands()).toContain("test");
		});

		it("should register a command with subcommands", () => {
			router.register({
				name: "git",
				description: "Git operations",
				subcommands: [
					{
						name: "clone",
						description: "Clone repository",
						handler: mockSubHandler,
					},
				],
				handler: mockHandler,
			});

			expect(router.getAvailableSubcommands("git")).toContain("clone");
		});
	});

	describe("execute", () => {
		beforeEach(() => {
			router.register({
				name: "test",
				description: "Test command",
				handler: mockHandler,
			});

			router.register({
				name: "git",
				description: "Git operations",
				subcommands: [
					{
						name: "clone",
						description: "Clone repository",
						handler: mockSubHandler,
					},
				],
				handler: mockHandler,
			});
		});

		it("should execute main command handler", async () => {
			const args: ParsedArgs = {
				command: "test",
				subcommand: undefined,
				options: {},
				positional: [],
			};

			await router.execute(args);
			expect(mockHandler).toHaveBeenCalledWith(args);
		});

		it("should execute subcommand handler", async () => {
			const args: ParsedArgs = {
				command: "git",
				subcommand: "clone",
				options: {},
				positional: [],
			};

			await router.execute(args);
			expect(mockSubHandler).toHaveBeenCalledWith(args);
			expect(mockHandler).not.toHaveBeenCalled();
		});

		it("should throw for unknown command", async () => {
			const args: ParsedArgs = {
				command: "unknown",
				subcommand: undefined,
				options: {},
				positional: [],
			};

			await expect(router.execute(args)).rejects.toThrow("Unknown command");
		});

		it("should throw for unknown subcommand", async () => {
			const args: ParsedArgs = {
				command: "git",
				subcommand: "unknown",
				options: {},
				positional: [],
			};

			await expect(router.execute(args)).rejects.toThrow("Unknown subcommand");
		});

		it("should execute main handler when subcommand provided but no subcommands defined", async () => {
			const args: ParsedArgs = {
				command: "test",
				subcommand: "something",
				options: {},
				positional: [],
			};

			await router.execute(args);
			expect(mockHandler).toHaveBeenCalledWith(args);
		});
	});

	describe("getAvailableCommands", () => {
		it("should return empty array when no commands registered", () => {
			expect(router.getAvailableCommands()).toEqual([]);
		});

		it("should return all registered command names", () => {
			router.register({
				name: "init",
				description: "Initialize",
				handler: mockHandler,
			});
			router.register({
				name: "start-pr",
				description: "Start PR",
				handler: mockHandler,
			});

			const commands = router.getAvailableCommands();
			expect(commands).toContain("init");
			expect(commands).toContain("start-pr");
		});
	});

	describe("getCommandDescription", () => {
		it("should return command description", () => {
			router.register({
				name: "test",
				description: "Test command",
				handler: mockHandler,
			});

			expect(router.getCommandDescription("test")).toBe("Test command");
		});

		it("should return undefined for unknown command", () => {
			expect(router.getCommandDescription("unknown")).toBeUndefined();
		});
	});

	describe("getAvailableSubcommands", () => {
		it("should return empty array for command without subcommands", () => {
			router.register({
				name: "test",
				description: "Test command",
				handler: mockHandler,
			});

			expect(router.getAvailableSubcommands("test")).toEqual([]);
		});

		it("should return subcommand names", () => {
			router.register({
				name: "git",
				description: "Git operations",
				subcommands: [
					{
						name: "clone",
						description: "Clone repository",
						handler: mockSubHandler,
					},
					{
						name: "push",
						description: "Push changes",
						handler: mockSubHandler,
					},
				],
				handler: mockHandler,
			});

			const subcommands = router.getAvailableSubcommands("git");
			expect(subcommands).toContain("clone");
			expect(subcommands).toContain("push");
		});

		it("should return empty array for unknown command", () => {
			expect(router.getAvailableSubcommands("unknown")).toEqual([]);
		});
	});

	describe("generateHelp", () => {
		it("should generate help for commands without subcommands", () => {
			router.register({
				name: "init",
				description: "Initialize project",
				handler: mockHandler,
			});

			const help = router.generateHelp();
			expect(help).toContain("Available commands:");
			expect(help).toContain("init");
			expect(help).toContain("Initialize project");
		});

		it("should generate help for commands with subcommands", () => {
			router.register({
				name: "git",
				description: "Git operations",
				subcommands: [
					{
						name: "clone",
						description: "Clone repository",
						handler: mockSubHandler,
					},
				],
				handler: mockHandler,
			});

			const help = router.generateHelp();
			expect(help).toContain("git");
			expect(help).toContain("Git operations");
			expect(help).toContain("clone");
			expect(help).toContain("Clone repository");
		});
	});
});
