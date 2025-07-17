import { describe, it, expect } from "vitest";
import { configSchema } from "./schema.js";

describe("Config Schema Validation", () => {
	const validConfig = {
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
		],
		projects: [
			{
				path: "./frontend",
				type: "typescript",
				registries: ["npm"],
			},
			{
				path: "./backend",
				type: "rust",
				registries: ["crates"],
			},
		],
		releaseNotes: {
			enabled: true,
			template: "## Changes\\n\\n{{changes}}\\n\\n## Contributors\\n\\n{{contributors}}",
		},
	};

	it("should validate a valid config", () => {
		expect(() => configSchema.parse(validConfig)).not.toThrow();
	});

	it("should validate baseVersion format", () => {
		const invalidConfig = { ...validConfig, baseVersion: "invalid" };
		expect(() => configSchema.parse(invalidConfig)).toThrow();
	});

	it("should validate project types", () => {
		const invalidConfig = {
			...validConfig,
			projects: [
				{
					path: "./frontend",
					type: "invalid",
					registries: ["npm"],
				},
			],
		};
		expect(() => configSchema.parse(invalidConfig)).toThrow();
	});

	it("should validate registry types", () => {
		const invalidConfig = {
			...validConfig,
			projects: [
				{
					path: "./frontend",
					type: "typescript",
					registries: ["invalid"],
				},
			],
		};
		expect(() => configSchema.parse(invalidConfig)).toThrow();
	});

	it("should validate versionSuffixStrategy", () => {
		const invalidConfig = {
			...validConfig,
			versionTags: [
				{
					alpha: {
						versionSuffixStrategy: "invalid",
					},
				},
			],
		};
		expect(() => configSchema.parse(invalidConfig)).toThrow();
	});

	it("should use default versionSuffixStrategy", () => {
		const configWithoutStrategy = {
			...validConfig,
			versionTags: [
				{
					alpha: {},
				},
			],
		};
		const result = configSchema.parse(configWithoutStrategy);
		expect(result.versionTags[0].alpha.versionSuffixStrategy).toBe("timestamp");
	});

	it("should accept custom version tag names", () => {
		const configWithCustomTags = {
			...validConfig,
			versionTags: [
				{
					dev: {
						versionSuffixStrategy: "timestamp",
					},
				},
				{
					staging: {
						versionSuffixStrategy: "increment",
						next: "stable",
					},
				},
			],
		};
		expect(() => configSchema.parse(configWithCustomTags)).not.toThrow();
	});

	it("should validate required fields", () => {
		const { baseVersion, ...configWithoutBase } = validConfig;
		expect(() => configSchema.parse(configWithoutBase)).toThrow();
	});
});