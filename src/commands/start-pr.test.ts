import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startPrCommand } from "./start-pr.js";

// Mock dependencies
vi.mock("../config/parser.js", () => ({
	loadConfig: vi.fn(),
}));

vi.mock("../fs/utils.js", () => ({
	writeFile: vi.fn(),
}));

vi.mock("../git/operations.js", () => ({
	createBranch: vi.fn(),
	pullLatest: vi.fn(),
}));

vi.mock("../interactive/prompts.js", () => ({
	askChoice: vi.fn(),
	askInput: vi.fn(),
}));

vi.mock("../version/calculator.js", () => ({
	calculateNextVersion: vi.fn(),
}));

const mockLoadConfig = vi.mocked(
	(await import("../config/parser.js")).loadConfig,
);
const mockWriteFile = vi.mocked((await import("../fs/utils.js")).writeFile);
const mockCreateBranch = vi.mocked(
	(await import("../git/operations.js")).createBranch,
);
const mockPullLatest = vi.mocked(
	(await import("../git/operations.js")).pullLatest,
);
const mockAskChoice = vi.mocked(
	(await import("../interactive/prompts.js")).askChoice,
);
const mockAskInput = vi.mocked(
	(await import("../interactive/prompts.js")).askInput,
);
const mockCalculateNextVersion = vi.mocked(
	(await import("../version/calculator.js")).calculateNextVersion,
);

describe("commands/start-pr", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		vi.clearAllMocks();

		// Default mock implementations
		mockLoadConfig.mockResolvedValue({
			baseVersion: "1.0.0",
			versionTags: [
				{
					alpha: {
						versionSuffixStrategy: "timestamp" as const,
					},
				},
				{
					rc: {
						versionSuffixStrategy: "increment" as const,
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
			],
			releaseNotes: {
				enabled: true,
				template: "## Changes\n\n{{changes}}",
			},
		});

		mockPullLatest.mockResolvedValue();
		mockCreateBranch.mockResolvedValue();
		mockWriteFile.mockResolvedValue();
		mockCalculateNextVersion.mockReturnValue("1.0.1-rc.0");
		mockAskChoice.mockResolvedValue("rc");
		mockAskInput.mockResolvedValue("feat/new-feature");
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		vi.resetAllMocks();
	});

	describe("startPrCommand", () => {
		it("should complete full start-pr workflow", async () => {
			await startPrCommand();

			// Verify workflow steps
			expect(consoleSpy).toHaveBeenCalledWith("🚀 Starting release PR...");
			expect(consoleSpy).toHaveBeenCalledWith("📥 Pulling latest changes...");
			expect(mockPullLatest).toHaveBeenCalledOnce();

			// Should present version tag choices
			expect(mockAskChoice).toHaveBeenCalledWith(
				"Select version tag for this release:",
				[
					{ name: "alpha", value: "alpha" },
					{ name: "rc", value: "rc" },
				],
			);

			// Should ask for branch name
			expect(mockAskInput).toHaveBeenCalledWith(
				"Enter branch name",
				"feat/release",
			);

			// Should calculate version
			expect(mockCalculateNextVersion).toHaveBeenCalledWith(
				"1.0.0",
				"rc",
				"increment",
			);

			// Should create branch
			expect(mockCreateBranch).toHaveBeenCalledWith("rc:feat/new-feature");

			// Should create tracking file
			expect(mockWriteFile).toHaveBeenCalledWith(
				".cdtools/rc_feat_new_feature.json",
				expect.stringContaining('"tag": "rc"'),
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"✅ Release PR started successfully!",
			);
		});

		it("should handle alpha version tag selection", async () => {
			mockAskChoice.mockResolvedValue("alpha");
			mockCalculateNextVersion.mockReturnValue("1.0.1-alpha.20250717123456");

			await startPrCommand();

			expect(mockCalculateNextVersion).toHaveBeenCalledWith(
				"1.0.0",
				"alpha",
				"increment",
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"🏷️  Target version: 1.0.1-alpha.20250717123456",
			);
		});

		it("should sanitize branch names for tracking file", async () => {
			mockAskInput.mockResolvedValue("feat/special-chars@#$");

			await startPrCommand();

			expect(mockWriteFile).toHaveBeenCalledWith(
				".cdtools/rc_feat_special_chars___.json",
				expect.any(String),
			);
		});

		it("should create correct tracking file content", async () => {
			const mockDate = new Date("2025-07-17T12:00:00Z");
			vi.setSystemTime(mockDate);

			await startPrCommand();

			const writeFileCall = mockWriteFile.mock.calls.find((call) =>
				call[0].endsWith(".json"),
			);
			expect(writeFileCall).toBeDefined();

			const trackingData = JSON.parse(writeFileCall![1]);
			expect(trackingData).toEqual({
				tag: "rc",
				branch: "rc:feat/new-feature",
				baseVersion: "1.0.0",
				currentVersion: "1.0.1-rc.0",
				releasedWorkspaces: {},
				createdAt: "2025-07-17T12:00:00.000Z",
			});

			vi.useRealTimers();
		});

		it("should handle custom branch names", async () => {
			mockAskInput.mockResolvedValue("hotfix/critical-bug");

			await startPrCommand();

			expect(mockCreateBranch).toHaveBeenCalledWith("rc:hotfix/critical-bug");
			expect(mockWriteFile).toHaveBeenCalledWith(
				".cdtools/rc_hotfix_critical_bug.json",
				expect.any(String),
			);
		});

		it("should use default branch name when empty input", async () => {
			mockAskInput.mockResolvedValue("");
			// Mock should handle empty input by returning default
			mockAskInput.mockResolvedValue("feat/release");

			await startPrCommand();

			expect(mockCreateBranch).toHaveBeenCalledWith("rc:feat/release");
		});

		it("should handle single version tag configuration", async () => {
			mockLoadConfig.mockResolvedValue({
				baseVersion: "1.0.0",
				versionTags: [
					{
						dev: {
							versionSuffixStrategy: "timestamp" as const,
						},
					},
				],
				projects: [],
				releaseNotes: { enabled: false, template: "" },
			});

			await startPrCommand();

			expect(mockAskChoice).toHaveBeenCalledWith(
				"Select version tag for this release:",
				[{ name: "dev", value: "dev" }],
			);
		});

		it("should handle configuration loading errors", async () => {
			mockLoadConfig.mockRejectedValue(new Error("Config not found"));

			await expect(startPrCommand()).rejects.toThrow("Config not found");
		});

		it("should handle git operations errors", async () => {
			mockPullLatest.mockRejectedValue(new Error("Git pull failed"));

			await expect(startPrCommand()).rejects.toThrow("Git pull failed");
		});

		it("should handle branch creation errors", async () => {
			mockCreateBranch.mockRejectedValue(new Error("Branch already exists"));

			await expect(startPrCommand()).rejects.toThrow("Branch already exists");
		});

		it("should handle file writing errors", async () => {
			mockWriteFile.mockRejectedValue(new Error("Permission denied"));

			await expect(startPrCommand()).rejects.toThrow("Permission denied");
		});

		it("should display helpful next steps", async () => {
			await startPrCommand();

			expect(consoleSpy).toHaveBeenCalledWith("Next steps:");
			expect(consoleSpy).toHaveBeenCalledWith("1. Make your changes");
			expect(consoleSpy).toHaveBeenCalledWith(
				"2. Run 'cd-tools push-pr' to update versions and create PR",
			);
		});

		it("should handle invalid version tag configuration", async () => {
			mockLoadConfig.mockResolvedValue({
				baseVersion: "1.0.0",
				versionTags: [
					{}, // Invalid - no tag name
				],
				projects: [],
				releaseNotes: { enabled: false, template: "" },
			});

			await expect(startPrCommand()).rejects.toThrow(
				"Invalid version tag configuration",
			);
		});

		it("should log version information", async () => {
			await startPrCommand();

			expect(consoleSpy).toHaveBeenCalledWith("🏷️  Target version: 1.0.1-rc.0");
			expect(consoleSpy).toHaveBeenCalledWith(
				"🌿 Creating branch: rc:feat/new-feature",
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				"📝 Created tracking file: .cdtools/rc_feat_new_feature.json",
			);
		});

		it("should handle complex version tag structures", async () => {
			mockLoadConfig.mockResolvedValue({
				baseVersion: "2.1.0",
				versionTags: [
					{
						"pre-alpha": {
							versionSuffixStrategy: "timestamp" as const,
						},
					},
					{
						"release-candidate": {
							versionSuffixStrategy: "increment" as const,
							next: "stable",
						},
					},
				],
				projects: [],
				releaseNotes: { enabled: false, template: "" },
			});

			mockAskChoice.mockResolvedValue("release-candidate");

			await startPrCommand();

			expect(mockAskChoice).toHaveBeenCalledWith(
				"Select version tag for this release:",
				[
					{ name: "pre-alpha", value: "pre-alpha" },
					{ name: "release-candidate", value: "release-candidate" },
				],
			);

			expect(mockCalculateNextVersion).toHaveBeenCalledWith(
				"2.1.0",
				"release-candidate",
				"increment",
			);
		});
	});
});
