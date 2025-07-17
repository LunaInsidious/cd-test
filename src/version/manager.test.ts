import { beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../config/index.js";
import { VersionManager, VersionManagerError } from "./manager.js";

describe("Version Manager", () => {
	const mockConfig: Config = {
		baseVersion: "1.0.0",
		versionTags: [
			{
				alpha: {
					versionSuffixStrategy: "timestamp",
				},
			},
			{
				rc: {
					versionSuffixStrategy: "increment",
					next: "stable",
				},
			},
			{
				dev: {
					versionSuffixStrategy: "increment",
					next: "alpha",
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
			template: "## Changes\n\n{{changes}}",
		},
	};

	let manager: VersionManager;

	beforeEach(() => {
		manager = new VersionManager(mockConfig);
	});

	describe("getAvailableTags", () => {
		it("should return all available tags", () => {
			const tags = manager.getAvailableTags();
			expect(tags).toEqual(["alpha", "rc", "dev"]);
		});
	});

	describe("getTagConfig", () => {
		it("should return config for existing tag", () => {
			const config = manager.getTagConfig("alpha");
			expect(config).toEqual({
				versionSuffixStrategy: "timestamp",
			});
		});

		it("should return undefined for non-existing tag", () => {
			const config = manager.getTagConfig("nonexistent");
			expect(config).toBeUndefined();
		});
	});

	describe("calculateVersionForTag", () => {
		it("should calculate stable version", () => {
			const version = manager.calculateVersionForTag("stable");
			expect(version).toBe("1.0.1");
		});

		it("should calculate alpha version with timestamp", () => {
			// Since timestamp is time-dependent, just check format
			const version = manager.calculateVersionForTag("alpha");
			expect(version).toMatch(/^1\.0\.1-alpha\.\d{14}$/);
		});

		it("should calculate rc version with increment", () => {
			const version = manager.calculateVersionForTag("rc");
			expect(version).toBe("1.0.1-rc.0");
		});

		it("should increment existing rc version", () => {
			const version = manager.calculateVersionForTag("rc", "1.0.1-rc.5");
			expect(version).toBe("1.0.1-rc.6");
		});

		it("should throw for unknown tag", () => {
			expect(() => manager.calculateVersionForTag("unknown")).toThrow(
				VersionManagerError,
			);
		});
	});

	describe("calculateNextTagVersion", () => {
		it("should transition rc to stable", () => {
			const version = manager.calculateNextTagVersion("rc", "1.0.1-rc.5");
			expect(version).toBe("1.0.1");
		});

		it("should transition dev to alpha", () => {
			const version = manager.calculateNextTagVersion("dev", "1.0.1-dev.3");
			expect(version).toBe("1.0.1-alpha.0");
		});

		it("should continue with same tag if no next specified", () => {
			const version = manager.calculateNextTagVersion("alpha", "1.0.1-alpha.20230629135030");
			// Alpha uses timestamp, so just check format
			expect(version).toMatch(/^1\.0\.1-alpha\.\d{14}$/);
		});

		it("should throw for unknown tag", () => {
			expect(() => manager.calculateNextTagVersion("unknown")).toThrow(
				VersionManagerError,
			);
		});
	});

	describe("isValidTag", () => {
		it("should return true for stable", () => {
			expect(manager.isValidTag("stable")).toBe(true);
		});

		it("should return true for configured tags", () => {
			expect(manager.isValidTag("alpha")).toBe(true);
			expect(manager.isValidTag("rc")).toBe(true);
			expect(manager.isValidTag("dev")).toBe(true);
		});

		it("should return false for unknown tags", () => {
			expect(manager.isValidTag("unknown")).toBe(false);
		});
	});

	describe("getTagStrategy", () => {
		it("should return increment for stable", () => {
			expect(manager.getTagStrategy("stable")).toBe("increment");
		});

		it("should return configured strategy for tags", () => {
			expect(manager.getTagStrategy("alpha")).toBe("timestamp");
			expect(manager.getTagStrategy("rc")).toBe("increment");
		});

		it("should throw for unknown tag", () => {
			expect(() => manager.getTagStrategy("unknown")).toThrow(
				VersionManagerError,
			);
		});
	});
});