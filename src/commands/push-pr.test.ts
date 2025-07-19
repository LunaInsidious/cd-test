vi.stubGlobal("process", {
	...global.process,
	exit: vi.fn((code) => {
		throw new Error(`process.exit() called with code ${code}`);
	}),
});

import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { pushPrCommand } from "./push-pr.js";

// Mock external dependencies
vi.mock("prompts", () => ({
	default: vi.fn(),
}));

vi.mock("../utils/config.js", () => ({
	checkInitialized: vi.fn(),
	loadConfig: vi.fn(),
	loadBranchInfo: vi.fn(),
	updateBranchInfo: vi.fn(),
}));

vi.mock("../utils/git.js", () => ({
	getCurrentBranch: vi.fn(),
	getChangedFiles: vi.fn(),
	commitChanges: vi.fn(),
	pushChanges: vi.fn(),
	getAvailableBranches: vi.fn(),
}));

vi.mock("../utils/version-updater.js", () => ({
	updateMultipleProjectVersions: vi.fn(),
}));

vi.mock("../utils/github.js", () => ({
	checkPrExists: vi.fn(),
	createPullRequestInteractive: vi.fn(),
}));

vi.mock("node:process", () => ({
	exit: vi.fn(),
}));

import prompts from "prompts";
import {
	type Config,
	checkInitialized,
	loadBranchInfo,
	loadConfig,
	updateBranchInfo,
} from "../utils/config.js";
import {
	commitChanges,
	getChangedFiles,
	getCurrentBranch,
	pushChanges,
} from "../utils/git.js";
import {
	checkPrExists,
	createPullRequestInteractive,
} from "../utils/github.js";
import { updateMultipleProjectVersions } from "../utils/version-updater.js";

// Mock typed functions
const mockPrompts = vi.mocked(prompts);
const mockCheckInitialized = vi.mocked(checkInitialized);
const mockLoadConfig = vi.mocked(loadConfig);
const mockLoadBranchInfo = vi.mocked(loadBranchInfo);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockUpdateBranchInfo = vi.mocked(updateBranchInfo);
const mockCommitChanges = vi.mocked(commitChanges);
const mockPushChanges = vi.mocked(pushChanges);
const mockUpdateMultipleProjectVersions = vi.mocked(
	updateMultipleProjectVersions,
);
const mockCheckPrExists = vi.mocked(checkPrExists);
const mockCreatePullRequestInteractive = vi.mocked(
	createPullRequestInteractive,
);
let mockProcessExit: MockInstance<
	(code?: number | string | null | undefined) => never
>;
let mockConsoleLog: MockInstance<
	(message?: unknown, ...optionalParams: unknown[]) => void
>;
let mockConsoleError: MockInstance<
	(message?: unknown, ...optionalParams: unknown[]) => void
>;

const mockConfig: Config = {
	versioningStrategy: "fixed",
	versionTags: [
		{
			alpha: { versionSuffixStrategy: "timestamp" },
			rc: { versionSuffixStrategy: "increment" },
		},
	],
	projects: [
		{
			path: "package-a",
			type: "npm",
			baseVersion: "1.0.0",
			bumpedVersions: [],
			deps: ["package.json"],
			registries: ["npm"],
		},
		{
			path: "package-b",
			type: "npm",
			baseVersion: "2.1.0",
			bumpedVersions: ["patch"],
			deps: ["package.json"],
			registries: ["npm"],
		},
	],
};

const mockBranchInfo = {
	tag: "alpha",
	parentBranch: "main",
};

describe("pushPrCommand", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockProcessExit = vi.spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`process.exit() called with code ${code}`);
		});

		mockConsoleLog = vi.spyOn(console, "log");
		mockConsoleError = vi.spyOn(console, "error");
		// Set default successful mocks
		mockCheckInitialized.mockResolvedValue(true);
		mockLoadConfig.mockResolvedValue(mockConfig);
		mockGetCurrentBranch.mockResolvedValue("feat/test(alpha)");
		mockLoadBranchInfo.mockResolvedValue(mockBranchInfo);
		mockGetChangedFiles.mockResolvedValue([
			"package-a/src/index.ts",
			"package-b/package.json",
		]);
		mockUpdateBranchInfo.mockResolvedValue(undefined);
		mockCommitChanges.mockResolvedValue(undefined);
		mockPushChanges.mockResolvedValue(undefined);
		mockUpdateMultipleProjectVersions.mockResolvedValue(undefined);
		mockCheckPrExists.mockResolvedValue(false);
		mockCreatePullRequestInteractive.mockResolvedValue(
			"https://github.com/test/repo/pull/123",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization checks", () => {
		it("should display error and exit if not initialized", async () => {
			mockCheckInitialized.mockResolvedValue(false);

			await expect(pushPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ cd-tools has not been initialized. Run 'cd-tools init' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if config loading fails", async () => {
			mockLoadConfig.mockRejectedValue(new Error("Config not found"));

			await expect(pushPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ Failed to load configuration: Config not found",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if branch info not found", async () => {
			mockLoadBranchInfo.mockResolvedValue(null);

			await expect(pushPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ No branch info found. Run 'cd-tools start-pr' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});
	});

	describe("successful flow", () => {
		it("should complete push-pr command successfully with console output", async () => {
			// Allow console output for this test
			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");

			mockPrompts.mockResolvedValueOnce({ bumpType: "patch" });

			// Mock Date for predictable timestamp
			const mockDate = new Date("2023-12-25T10:30:45.123Z");
			vi.setSystemTime(mockDate);

			await pushPrCommand();

			// Verify key function calls
			expect(mockCheckInitialized).toHaveBeenCalled();
			expect(mockLoadConfig).toHaveBeenCalled();
			expect(mockGetCurrentBranch).toHaveBeenCalled();
			expect(mockLoadBranchInfo).toHaveBeenCalled();
			expect(mockPrompts).toHaveBeenCalled();

			// Check console output
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🚀 Updating versions and creating PR...",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"📂 Current branch: feat/test(alpha)",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith("🏷️  Release mode: alpha");
			expect(consoleLogSpy).toHaveBeenCalledWith("📁 Parent branch: main");
			expect(consoleLogSpy).toHaveBeenCalledWith("\n📋 Version updates:");
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-a: 1.0.1-alpha.20231225103045",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-b: 2.1.0-alpha.20231225103045",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✅ Push PR completed successfully!",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle user cancellation", async () => {
			mockPrompts.mockResolvedValueOnce({ bumpType: undefined });

			await expect(pushPrCommand()).rejects.toThrow();
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});
	});
});
