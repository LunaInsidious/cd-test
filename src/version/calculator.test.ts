import { describe, expect, it, vi } from "vitest";
import {
	VersionCalculationError,
	calculateNextVersion,
	formatVersion,
	generateTimestampSuffix,
	getNextTagVersion,
	parseVersion,
} from "./calculator.js";

describe("Version Calculator", () => {
	describe("parseVersion", () => {
		it("should parse valid version strings", () => {
			expect(parseVersion("1.0.0")).toEqual({
				major: 1,
				minor: 0,
				patch: 0,
			});

			expect(parseVersion("2.5.10")).toEqual({
				major: 2,
				minor: 5,
				patch: 10,
			});

			expect(parseVersion("1.0.0-alpha.1")).toEqual({
				major: 1,
				minor: 0,
				patch: 0,
				prerelease: "alpha.1",
			});
		});

		it("should throw for invalid version formats", () => {
			expect(() => parseVersion("invalid")).toThrow(VersionCalculationError);
			expect(() => parseVersion("1.0")).toThrow(VersionCalculationError);
			expect(() => parseVersion("1.0.0.0")).toThrow(VersionCalculationError);
		});
	});

	describe("formatVersion", () => {
		it("should format version without prerelease", () => {
			expect(
				formatVersion({
					major: 1,
					minor: 0,
					patch: 0,
				}),
			).toBe("1.0.0");
		});

		it("should format version with prerelease", () => {
			expect(
				formatVersion({
					major: 1,
					minor: 0,
					patch: 0,
					prerelease: "alpha.1",
				}),
			).toBe("1.0.0-alpha.1");
		});
	});

	describe("generateTimestampSuffix", () => {
		it("should generate timestamp in correct format", () => {
			// Mock Date to have predictable output
			const mockDate = new Date("2023-06-29T13:50:30Z");
			vi.setSystemTime(mockDate);

			const result = generateTimestampSuffix();
			expect(result).toBe("20230629135030");

			vi.useRealTimers();
		});

		it("should pad single digits with zeros", () => {
			const mockDate = new Date("2023-01-01T01:01:01Z");
			vi.setSystemTime(mockDate);

			const result = generateTimestampSuffix();
			expect(result).toBe("20230101010101");

			vi.useRealTimers();
		});
	});

	describe("calculateNextVersion", () => {
		it("should calculate stable version increment", () => {
			const result = calculateNextVersion("1.0.0", "stable", "increment");
			expect(result).toBe("1.0.1");
		});

		it("should calculate timestamp version", () => {
			const mockDate = new Date("2023-06-29T13:50:30Z");
			vi.setSystemTime(mockDate);

			const result = calculateNextVersion("1.0.0", "alpha", "timestamp");
			expect(result).toBe("1.0.1-alpha.20230629135030");

			vi.useRealTimers();
		});

		it("should calculate increment version from scratch", () => {
			const result = calculateNextVersion("1.0.0", "rc", "increment");
			expect(result).toBe("1.0.1-rc.0");
		});

		it("should increment existing version with same tag", () => {
			const result = calculateNextVersion(
				"1.0.0",
				"rc",
				"increment",
				"1.0.1-rc.5",
			);
			expect(result).toBe("1.0.1-rc.6");
		});

		it("should start from 0 for different tag", () => {
			const result = calculateNextVersion(
				"1.0.0",
				"alpha",
				"increment",
				"1.0.1-rc.5",
			);
			expect(result).toBe("1.0.1-alpha.0");
		});

		it("should handle invalid current version gracefully", () => {
			const result = calculateNextVersion(
				"1.0.0",
				"rc",
				"increment",
				"invalid-version",
			);
			expect(result).toBe("1.0.1-rc.0");
		});
	});

	describe("getNextTagVersion", () => {
		it("should transition to stable version", () => {
			const result = getNextTagVersion(
				"1.0.0",
				"rc",
				"stable",
				"1.0.1-rc.5",
			);
			expect(result).toBe("1.0.1");
		});

		it("should transition to stable without current version", () => {
			const result = getNextTagVersion("1.0.0", "rc", "stable");
			expect(result).toBe("1.0.1");
		});

		it("should transition to another prerelease tag", () => {
			const result = getNextTagVersion(
				"1.0.0",
				"alpha",
				"rc",
				"1.0.1-alpha.5",
			);
			expect(result).toBe("1.0.1-rc.0");
		});
	});
});