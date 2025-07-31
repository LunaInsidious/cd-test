import { beforeEach, describe, expect, it, vi } from "vitest";
import * as gitUtils from "../utils/git.js";
import {
	generateVersionWithSuffix,
	getNextIncrementFromTags,
} from "./common.js";

vi.mock("../utils/git.js");

describe("common", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getNextIncrementFromTags", () => {
		it("should return 0 when no matching tags exist", () => {
			const result = getNextIncrementFromTags([], "1.0.0", "alpha");
			expect(result).toBe(0);
		});

		it("should return next increment when matching tags exist", () => {
			const existingTags = ["1.0.0-alpha.0", "1.0.0-alpha.1", "1.0.0-alpha.2"];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(3);
		});

		it("should handle tags with project prefixes", () => {
			const existingTags = [
				"lib-name-1.0.0-alpha.0",
				"lib-name-1.0.0-alpha.3",
				"lib-name-1.0.0-alpha.1",
			];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(4);
		});

		it("should ignore non-matching tags", () => {
			const existingTags = [
				"1.0.0-beta.0",
				"1.0.1-alpha.0",
				"2.0.0-alpha.0",
				"1.0.0-alpha.5",
			];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(6);
		});

		it("should handle tags with special regex characters", () => {
			const existingTags = ["1.0.0-alpha.0", "1.0.0-alpha.1"];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(2);
		});

		it("should handle version strings with special characters", () => {
			const existingTags = ["v1.0.0+build-rc.0", "v1.0.0+build-rc.1"];
			const result = getNextIncrementFromTags(
				existingTags,
				"v1.0.0+build",
				"rc",
			);
			expect(result).toBe(2);
		});

		it("should return 0 when tags have invalid increment numbers", () => {
			const existingTags = ["1.0.0-alpha.abc", "1.0.0-alpha"];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(0);
		});

		it("should handle mixed valid and invalid increment formats", () => {
			const existingTags = [
				"1.0.0-alpha.0",
				"1.0.0-alpha.invalid",
				"1.0.0-alpha.2",
				"1.0.0-alpha",
			];
			const result = getNextIncrementFromTags(existingTags, "1.0.0", "alpha");
			expect(result).toBe(3);
		});
	});

	describe("generateVersionWithSuffix", () => {
		describe("timestamp strategy", () => {
			it("should generate version with timestamp suffix", async () => {
				const mockDate = new Date("2025-01-15T12:34:56.789Z");
				vi.spyOn(global, "Date").mockImplementation(() => mockDate);

				const result = await generateVersionWithSuffix(
					"1.0.0",
					"alpha",
					"timestamp",
				);
				expect(result).toBe("1.0.0-alpha.20250115123456");

				vi.restoreAllMocks();
			});

			it("should handle different timestamps correctly", async () => {
				const mockDate = new Date("2024-12-31T23:59:59.999Z");
				vi.spyOn(global, "Date").mockImplementation(() => mockDate);

				const result = await generateVersionWithSuffix(
					"2.5.3",
					"beta",
					"timestamp",
				);
				expect(result).toBe("2.5.3-beta.20241231235959");

				vi.restoreAllMocks();
			});
		});

		describe("increment strategy", () => {
			it("should generate version with increment suffix", async () => {
				vi.mocked(gitUtils.getTagsMatchingPattern).mockResolvedValue([
					"1.0.0-alpha.0",
					"1.0.0-alpha.1",
				]);

				const result = await generateVersionWithSuffix(
					"1.0.0",
					"alpha",
					"increment",
				);
				expect(result).toBe("1.0.0-alpha.2");
				expect(gitUtils.getTagsMatchingPattern).toHaveBeenCalledWith(
					"*1.0.0-alpha.*",
				);
			});

			it("should handle first increment when no tags exist", async () => {
				vi.mocked(gitUtils.getTagsMatchingPattern).mockResolvedValue([]);

				const result = await generateVersionWithSuffix(
					"1.0.0",
					"rc",
					"increment",
				);
				expect(result).toBe("1.0.0-rc.0");
			});

			it("should handle git tag lookup errors gracefully", async () => {
				const consoleWarnSpy = vi
					.spyOn(console, "warn")
					.mockImplementation(() => {});
				vi.mocked(gitUtils.getTagsMatchingPattern).mockRejectedValue(
					new Error("Git error"),
				);

				const result = await generateVersionWithSuffix(
					"1.0.0",
					"alpha",
					"increment",
				);
				expect(result).toBe("1.0.0-alpha.0");
				expect(consoleWarnSpy).toHaveBeenCalledWith(
					"Warning: Could not check existing tags for 1.0.0-alpha: Git error",
				);

				consoleWarnSpy.mockRestore();
			});

			it("should handle non-Error thrown values", async () => {
				const consoleWarnSpy = vi
					.spyOn(console, "warn")
					.mockImplementation(() => {});
				vi.mocked(gitUtils.getTagsMatchingPattern).mockRejectedValue(
					"string error",
				);

				const result = await generateVersionWithSuffix(
					"1.0.0",
					"beta",
					"increment",
				);
				expect(result).toBe("1.0.0-beta.0");
				expect(consoleWarnSpy).toHaveBeenCalledWith(
					"Warning: Could not check existing tags for 1.0.0-beta: string error",
				);

				consoleWarnSpy.mockRestore();
			});

			it("should correctly escape special characters in tag pattern", async () => {
				vi.mocked(gitUtils.getTagsMatchingPattern).mockResolvedValue([]);

				await generateVersionWithSuffix("1.0.0+build", "rc", "increment");
				expect(gitUtils.getTagsMatchingPattern).toHaveBeenCalledWith(
					"*1.0.0+build-rc.*",
				);
			});
		});
	});
});
