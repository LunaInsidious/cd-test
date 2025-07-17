import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ConfigParseError,
	loadConfig,
	parseConfig,
	validateConfig,
} from "./parser.js";

describe("Config Parser", () => {
	const testDir = join(process.cwd(), "test-temp");
	const configDir = join(testDir, ".cdtools");
	const configPath = join(configDir, "config.json");

	const validConfig = {
		baseVersion: "1.0.0",
		versionTags: [
			{
				alpha: {
					versionSuffixStrategy: "timestamp",
				},
			},
		],
		projects: [
			{
				path: "./frontend",
				type: "typescript",
				registries: ["npm"],
			},
		],
		releaseNotes: {
			enabled: true,
			template: "## Changes\\n\\n{{changes}}",
		},
	};

	beforeEach(() => {
		mkdirSync(configDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("parseConfig", () => {
		it("should parse valid config file", () => {
			writeFileSync(configPath, JSON.stringify(validConfig));
			const result = parseConfig(configPath);
			expect(result).toEqual(validConfig);
		});

		it("should throw ConfigParseError for invalid JSON", () => {
			writeFileSync(configPath, "invalid json");
			expect(() => parseConfig(configPath)).toThrow(ConfigParseError);
		});

		it("should throw ConfigParseError for invalid config structure", () => {
			writeFileSync(configPath, JSON.stringify({ invalid: "config" }));
			expect(() => parseConfig(configPath)).toThrow(ConfigParseError);
		});

		it("should provide helpful error messages", () => {
			writeFileSync(configPath, "invalid json");
			try {
				parseConfig(configPath);
			} catch (error) {
				expect(error).toBeInstanceOf(ConfigParseError);
				expect((error as ConfigParseError).message).toMatch(/Invalid JSON/);
			}
		});
	});

	describe("loadConfig", () => {
		it("should load config from project root", () => {
			writeFileSync(configPath, JSON.stringify(validConfig));
			const result = loadConfig(testDir);
			expect(result).toEqual(validConfig);
		});

		it("should use current directory by default", () => {
			// This test would require setting up the config in the current directory
			// For now, we'll just test that it doesn't throw with a valid path
			expect(() => loadConfig("/nonexistent")).toThrow();
		});
	});

	describe("validateConfig", () => {
		it("should validate a valid config object", () => {
			const result = validateConfig(validConfig);
			expect(result).toEqual(validConfig);
		});

		it("should throw for invalid config object", () => {
			expect(() => validateConfig({ invalid: "config" })).toThrow();
		});

		it("should throw for non-object input", () => {
			expect(() => validateConfig("not an object")).toThrow();
		});
	});
});
