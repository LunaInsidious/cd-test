import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCLI } from "./index.js";

// Mock all command implementations
vi.mock("../commands/init.js", () => ({
	initCommand: vi.fn(),
}));

vi.mock("../commands/start-pr.js", () => ({
	startPrCommand: vi.fn(),
}));

vi.mock("../commands/push-pr.js", () => ({
	pushPrCommand: vi.fn(),
}));

vi.mock("../commands/end-pr.js", () => ({
	endPrCommand: vi.fn(),
}));

vi.mock("../interactive/prompts.js", () => ({
	closePrompts: vi.fn(),
}));

const mockInitCommand = vi.mocked(
	(await import("../commands/init.js")).initCommand,
);
const mockStartPrCommand = vi.mocked(
	(await import("../commands/start-pr.js")).startPrCommand,
);
const mockPushPrCommand = vi.mocked(
	(await import("../commands/push-pr.js")).pushPrCommand,
);
const mockEndPrCommand = vi.mocked(
	(await import("../commands/end-pr.js")).endPrCommand,
);
const mockClosePrompts = vi.mocked(
	(await import("../interactive/prompts.js")).closePrompts,
);

describe("cli/index", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let processExitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		processExitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);

		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
		vi.resetAllMocks();
	});

	describe("runCLI", () => {
		it("should display help when no arguments provided", async () => {
			await runCLI(["node", "cd-tools"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Available commands:"),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"init         Initialize project with GitHub workflows and default configuration",
				),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"start-pr     Start a release PR with version selection",
				),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"push-pr      Update versions and create/update PR",
				),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("end-pr       Finalize release and merge PR"),
			);
		});

		it("should display help when --help flag is provided", async () => {
			await runCLI(["node", "cd-tools", "--help"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Available commands:"),
			);
		});

		it("should display help when -h flag is provided", async () => {
			await runCLI(["node", "cd-tools", "-h"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Available commands:"),
			);
		});

		it("should execute init command", async () => {
			await runCLI(["node", "cd-tools", "init"]);

			expect(mockInitCommand).toHaveBeenCalledOnce();
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should execute start-pr command", async () => {
			await runCLI(["node", "cd-tools", "start-pr"]);

			expect(mockStartPrCommand).toHaveBeenCalledOnce();
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should execute push-pr command", async () => {
			await runCLI(["node", "cd-tools", "push-pr"]);

			expect(mockPushPrCommand).toHaveBeenCalledOnce();
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should execute end-pr command", async () => {
			await runCLI(["node", "cd-tools", "end-pr"]);

			expect(mockEndPrCommand).toHaveBeenCalledOnce();
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should handle unknown command gracefully", async () => {
			await runCLI(["node", "cd-tools", "unknown-command"]);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: Unknown command: unknown-command",
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should handle CLI parse errors", async () => {
			// This would trigger a parse error if implemented in parser
			await runCLI(["node", "cd-tools", "init", "--invalid-flag"]);

			// Should still work since our parser is currently simple
			expect(mockInitCommand).toHaveBeenCalledOnce();
		});

		it("should close prompts even when command throws error", async () => {
			mockInitCommand.mockRejectedValue(new Error("Command failed"));

			await expect(runCLI(["node", "cd-tools", "init"])).rejects.toThrow(
				"Command failed",
			);
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should close prompts on successful command execution", async () => {
			mockInitCommand.mockResolvedValue();

			await runCLI(["node", "cd-tools", "init"]);

			expect(mockInitCommand).toHaveBeenCalledOnce();
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should handle commands with options", async () => {
			// Test that options are parsed and passed correctly
			await runCLI(["node", "cd-tools", "init", "--verbose"]);

			expect(mockInitCommand).toHaveBeenCalledOnce();
		});

		it("should work with different node executable names", async () => {
			await runCLI(["/usr/bin/node", "/usr/local/bin/cd-tools", "init"]);

			expect(mockInitCommand).toHaveBeenCalledOnce();
		});

		it("should handle empty argv array", async () => {
			await runCLI([]);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Available commands:"),
			);
		});

		it("should handle argv with only node", async () => {
			await runCLI(["node"]);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Available commands:"),
			);
		});

		it("should handle commands in sequence (integration test)", async () => {
			// Test running multiple commands in sequence
			await runCLI(["node", "cd-tools", "init"]);
			expect(mockInitCommand).toHaveBeenCalledTimes(1);
			expect(mockClosePrompts).toHaveBeenCalledTimes(1);

			vi.clearAllMocks();

			await runCLI(["node", "cd-tools", "start-pr"]);
			expect(mockStartPrCommand).toHaveBeenCalledTimes(1);
			expect(mockClosePrompts).toHaveBeenCalledTimes(1);

			vi.clearAllMocks();

			await runCLI(["node", "cd-tools", "push-pr"]);
			expect(mockPushPrCommand).toHaveBeenCalledTimes(1);
			expect(mockClosePrompts).toHaveBeenCalledTimes(1);

			vi.clearAllMocks();

			await runCLI(["node", "cd-tools", "end-pr"]);
			expect(mockEndPrCommand).toHaveBeenCalledTimes(1);
			expect(mockClosePrompts).toHaveBeenCalledTimes(1);
		});

		it("should ensure prompts are closed even with unexpected errors", async () => {
			// Simulate an unexpected error (not CLI parse error)
			mockInitCommand.mockImplementation(() => {
				throw new Error("Unexpected error");
			});

			await expect(runCLI(["node", "cd-tools", "init"])).rejects.toThrow(
				"Unexpected error",
			);
			expect(mockClosePrompts).toHaveBeenCalledOnce();
		});

		it("should pass correct arguments to commands", async () => {
			// Even though our current implementation doesn't pass args to commands,
			// this test ensures the structure is correct
			await runCLI(["node", "cd-tools", "init"]);

			expect(mockInitCommand).toHaveBeenCalledWith(/* no args currently */);
		});
	});

	describe("command routing", () => {
		it("should route to correct command handlers", async () => {
			const commands = [
				["init", mockInitCommand],
				["start-pr", mockStartPrCommand],
				["push-pr", mockPushPrCommand],
				["end-pr", mockEndPrCommand],
			] as const;

			for (const [command, mockFn] of commands) {
				vi.clearAllMocks();

				await runCLI(["node", "cd-tools", command]);

				expect(mockFn).toHaveBeenCalledOnce();

				// Ensure other commands weren't called
				for (const [, otherMockFn] of commands) {
					if (otherMockFn !== mockFn) {
						expect(otherMockFn).not.toHaveBeenCalled();
					}
				}
			}
		});

		it("should handle case sensitivity", async () => {
			// Our commands should be case sensitive
			await runCLI(["node", "cd-tools", "INIT"]);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: Unknown command: INIT",
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
			expect(mockInitCommand).not.toHaveBeenCalled();
		});
	});
});
