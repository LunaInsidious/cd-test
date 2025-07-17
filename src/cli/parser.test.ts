import { describe, expect, it } from "vitest";
import {
	CLIParseError,
	getBooleanOption,
	getOption,
	hasOption,
	parseArgs,
	validateCommand,
	validateSubcommand,
} from "./parser.js";

describe("CLI Parser", () => {
	describe("parseArgs", () => {
		it("should throw for empty args", () => {
			expect(() => parseArgs([])).toThrow(CLIParseError);
		});

		it("should parse command only", () => {
			const result = parseArgs(["init"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: {},
				positional: [],
			});
		});

		it("should parse command with subcommand", () => {
			const result = parseArgs(["git", "clone"]);
			expect(result).toEqual({
				command: "git",
				subcommand: "clone",
				options: {},
				positional: [],
			});
		});

		it("should parse command with positional args", () => {
			const result = parseArgs(["init", "arg1", "arg2"]);
			expect(result).toEqual({
				command: "init",
				subcommand: "arg1",
				options: {},
				positional: ["arg2"],
			});
		});

		it("should parse long options with values", () => {
			const result = parseArgs(["init", "--config", "path/to/config"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: { config: "path/to/config" },
				positional: [],
			});
		});

		it("should parse long options with equals syntax", () => {
			const result = parseArgs(["init", "--config=path/to/config"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: { config: "path/to/config" },
				positional: [],
			});
		});

		it("should parse boolean long options", () => {
			const result = parseArgs(["init", "--verbose"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: { verbose: true },
				positional: [],
			});
		});

		it("should parse short options with values", () => {
			const result = parseArgs(["init", "-c", "config.json"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: { c: "config.json" },
				positional: [],
			});
		});

		it("should parse boolean short options", () => {
			const result = parseArgs(["init", "-v"]);
			expect(result).toEqual({
				command: "init",
				subcommand: undefined,
				options: { v: true },
				positional: [],
			});
		});

		it("should parse mixed options and subcommand", () => {
			const result = parseArgs([
				"start-pr",
				"--tag",
				"rc",
				"feature",
				"--verbose",
			]);
			expect(result).toEqual({
				command: "start-pr",
				subcommand: "feature",
				options: { tag: "rc", verbose: true },
				positional: [],
			});
		});

		it("should handle options at end", () => {
			const result = parseArgs(["init", "subcommand", "arg1", "--verbose"]);
			expect(result).toEqual({
				command: "init",
				subcommand: "subcommand",
				options: { verbose: true },
				positional: ["arg1"],
			});
		});
	});

	describe("validateCommand", () => {
		it("should pass for valid command", () => {
			const args = parseArgs(["init"]);
			expect(() => validateCommand(args, ["init", "start-pr"])).not.toThrow();
		});

		it("should throw for invalid command", () => {
			const args = parseArgs(["invalid"]);
			expect(() => validateCommand(args, ["init", "start-pr"])).toThrow(
				CLIParseError,
			);
		});
	});

	describe("validateSubcommand", () => {
		it("should pass for valid subcommand", () => {
			const args = parseArgs(["git", "clone"]);
			expect(() =>
				validateSubcommand(args, ["clone", "push", "pull"]),
			).not.toThrow();
		});

		it("should pass when no subcommand provided", () => {
			const args = parseArgs(["git"]);
			expect(() =>
				validateSubcommand(args, ["clone", "push", "pull"]),
			).not.toThrow();
		});

		it("should throw for invalid subcommand", () => {
			const args = parseArgs(["git", "invalid"]);
			expect(() => validateSubcommand(args, ["clone", "push", "pull"])).toThrow(
				CLIParseError,
			);
		});
	});

	describe("hasOption", () => {
		it("should return true for existing option", () => {
			const args = parseArgs(["init", "--verbose"]);
			expect(hasOption(args, "verbose")).toBe(true);
		});

		it("should return false for non-existing option", () => {
			const args = parseArgs(["init"]);
			expect(hasOption(args, "verbose")).toBe(false);
		});
	});

	describe("getOption", () => {
		it("should return string option value", () => {
			const args = parseArgs(["init", "--config", "test.json"]);
			expect(getOption(args, "config")).toBe("test.json");
		});

		it("should return undefined for non-existing option", () => {
			const args = parseArgs(["init"]);
			expect(getOption(args, "config")).toBeUndefined();
		});

		it("should return default value for non-existing option", () => {
			const args = parseArgs(["init"]);
			expect(getOption(args, "config", "default.json")).toBe("default.json");
		});

		it("should return undefined for boolean option", () => {
			const args = parseArgs(["init", "--verbose"]);
			expect(getOption(args, "verbose")).toBeUndefined();
		});
	});

	describe("getBooleanOption", () => {
		it("should return true for boolean flag", () => {
			const args = parseArgs(["init", "--verbose"]);
			expect(getBooleanOption(args, "verbose")).toBe(true);
		});

		it("should return false for non-existing option with default false", () => {
			const args = parseArgs(["init"]);
			expect(getBooleanOption(args, "verbose")).toBe(false);
		});

		it("should return custom default for non-existing option", () => {
			const args = parseArgs(["init"]);
			expect(getBooleanOption(args, "verbose", true)).toBe(true);
		});

		it("should parse string 'true' as boolean", () => {
			const args = parseArgs(["init", "--debug", "true"]);
			expect(getBooleanOption(args, "debug")).toBe(true);
		});

		it("should parse string 'false' as boolean", () => {
			const args = parseArgs(["init", "--debug", "false"]);
			expect(getBooleanOption(args, "debug")).toBe(false);
		});

		it("should parse string '1' as true", () => {
			const args = parseArgs(["init", "--debug", "1"]);
			expect(getBooleanOption(args, "debug")).toBe(true);
		});

		it("should parse string '0' as false", () => {
			const args = parseArgs(["init", "--debug", "0"]);
			expect(getBooleanOption(args, "debug")).toBe(false);
		});
	});
});
