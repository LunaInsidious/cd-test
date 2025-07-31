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

vi.mock("../utils/config.js", async (importOriginal) => {
	const actual = await importOriginal();
	if (typeof actual !== "object" || actual === null) {
		throw new Error("Expected a module object");
	}
	return {
		...actual,
		loadConfig: vi.fn(),
		loadBranchInfo: vi.fn(),
		updateBranchInfo: vi.fn(),
		updateConfig: vi.fn(),
	};
});

vi.mock("../utils/git.js", () => ({
	getCurrentBranch: vi.fn(),
	getChangedFiles: vi.fn(),
	commitChanges: vi.fn(),
	pushChanges: vi.fn(),
	fetchAndPruneBranches: vi.fn(),
	getAvailableBranches: vi.fn(),
	getTagsMatchingPattern: vi.fn(),
}));

vi.mock("../utils/version-updater.js", () => ({
	updateMultipleProjectVersions: vi.fn(),
	getPackageName: vi.fn(),
}));

vi.mock("../utils/github.js", () => ({
	checkPrExists: vi.fn(),
	getCurrentPrUrl: vi.fn(),
	createPullRequest: vi.fn(),
}));

vi.mock("node:process", () => ({
	exit: vi.fn(),
}));

import prompts from "prompts";
import {
	type Config,
	loadBranchInfo,
	loadConfig,
	updateBranchInfo,
} from "../utils/config.js";
import { NotFoundError } from "../utils/error.js";
import {
	commitChanges,
	fetchAndPruneBranches,
	getAvailableBranches,
	getChangedFiles,
	getCurrentBranch,
	getTagsMatchingPattern,
	pushChanges,
} from "../utils/git.js";
import { createPullRequest, getCurrentPrUrl } from "../utils/github.js";
import {
	getPackageName,
	updateMultipleProjectVersions,
} from "../utils/version-updater.js";

// Mock typed functions
const mockPrompts = vi.mocked(prompts);
const mockLoadConfig = vi.mocked(loadConfig);
const mockLoadBranchInfo = vi.mocked(loadBranchInfo);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockUpdateBranchInfo = vi.mocked(updateBranchInfo);
const mockCommitChanges = vi.mocked(commitChanges);
const mockPushChanges = vi.mocked(pushChanges);
const mockGetAvailableBranches = vi.mocked(getAvailableBranches);
const mockFetchAndPruneBranches = vi.mocked(fetchAndPruneBranches);
const mockGetTagsMatchingPattern = vi.mocked(getTagsMatchingPattern);
const mockUpdateMultipleProjectVersions = vi.mocked(
	updateMultipleProjectVersions,
);
const mockGetPackageName = vi.mocked(getPackageName);
const mockGetCurrentPrUrl = vi.mocked(getCurrentPrUrl);
const mockCreatePullRequest = vi.mocked(createPullRequest);
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
			type: "typescript",
			baseVersion: "1.0.0",
			deps: ["package.json"],
			registries: ["npm"],
		},
		{
			path: "package-b",
			type: "typescript",
			baseVersion: "2.0.0",
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
		mockGetAvailableBranches.mockResolvedValue(["main", "develop"]);
		mockFetchAndPruneBranches.mockResolvedValue(undefined);
		mockGetTagsMatchingPattern.mockResolvedValue([]);
		// Default prompts response
		mockPrompts.mockResolvedValueOnce({ bumpType: "patch" });
		mockPrompts.mockResolvedValueOnce({ baseBranch: "main" });
		mockUpdateMultipleProjectVersions.mockResolvedValue(undefined);
		mockGetPackageName.mockImplementation(async (path: string) => {
			if (path === "package-b") return "package-b";
			return "package-a";
		});
		mockGetCurrentPrUrl.mockResolvedValue(null);
		mockCreatePullRequest.mockResolvedValue(
			"https://github.com/test/repo/pull/123",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization checks", () => {
		it("should display error and exit if not initialized", async () => {
			mockLoadConfig.mockRejectedValue(
				new NotFoundError("cd-tools has not been initialized"),
			);

			await expect(pushPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ Configuration file not found. Run 'cd-tools init' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if branch info not found", async () => {
			mockLoadBranchInfo.mockRejectedValue(
				new NotFoundError("Branch info not found"),
			);

			await expect(pushPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				'❌ Branch info not found for "feat/test(alpha)". Run "cd-tools start-pr" first.',
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
				"  • package-b: 2.0.1-alpha.20231225103045",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✅ Push PR completed successfully!",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle existing projectUpdated with minor bump", async () => {
			// Mock branch info with existing workspace updates
			const branchInfoWithWorkspace = {
				tag: "alpha",
				parentBranch: "main",
				projectUpdated: {
					"package-a": {
						version: "1.0.1-alpha.20231224103045",
						updatedAt: "2023-12-24T10:30:45.123Z",
					}, // patch already released (1.0.0 -> 1.0.1)
					"package-b": {
						version: "2.1.0-alpha.20231224103045",
						updatedAt: "2023-12-24T10:30:45.123Z",
					}, // minor already released (2.0.0 -> 2.1.0)
				},
			};
			mockLoadBranchInfo.mockResolvedValue(branchInfoWithWorkspace);

			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");
			mockPrompts.mockReset();
			mockPrompts.mockResolvedValueOnce({ bumpType: "minor" });
			mockPrompts.mockResolvedValueOnce({ baseBranch: "main" });

			const mockDate = new Date("2023-12-25T10:30:45.123Z");
			vi.setSystemTime(mockDate);

			await pushPrCommand();

			// package-a: can do minor (1.0.0 -> 1.1.0) because only patch was released
			// package-b: stays 2.1.0 because minor was already released
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-a: 1.1.0-alpha.20231225103045",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-b: 2.1.0-alpha.20231225103045",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle same bump type already released", async () => {
			const branchInfoWithUpdates = {
				tag: "alpha",
				parentBranch: "main",
				projectUpdated: {
					"package-a": {
						version: "1.0.1-alpha.20231224103045",
						updatedAt: "2023-12-24T10:30:45.123Z",
					}, // patch already released
					"package-b": {
						version: "2.1.0-alpha.20231224103045",
						updatedAt: "2023-12-24T10:30:45.123Z",
					}, // minor already released
				},
			};
			mockLoadBranchInfo.mockResolvedValue(branchInfoWithUpdates);

			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");
			mockPrompts.mockResolvedValueOnce({ bumpType: "patch" });

			const mockDate = new Date("2023-12-25T10:30:45.123Z");
			vi.setSystemTime(mockDate);

			await pushPrCommand();

			// Both keep projectUpdated versions because patch/minor already released
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-a: 1.0.1-alpha.20231225103045",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"  • package-b: 2.1.0-alpha.20231225103045",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle user cancellation", async () => {
			mockPrompts.mockReset();
			mockPrompts.mockRejectedValue(new Error("User cancelled"));

			await expect(pushPrCommand()).rejects.toThrow("User cancelled");
		});
	});
});
