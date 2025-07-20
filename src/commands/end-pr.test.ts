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
import { endPrCommand } from "./end-pr.js";

// Mock external dependencies
vi.mock("../utils/config.js", async (importOriginal) => {
	const actual = await importOriginal();
	if (typeof actual !== "object" || actual === null) {
		throw new Error("Expected a module object");
	}
	return {
		...actual,
		checkInitialized: vi.fn(),
		deleteBranchInfo: vi.fn(),
		loadBranchInfo: vi.fn(),
		loadConfig: vi.fn(),
		updateConfig: vi.fn(),
	};
});

vi.mock("../utils/git.js", () => ({
	getCurrentBranch: vi.fn(),
	commitChanges: vi.fn(),
	pushChanges: vi.fn(),
	getTagsMatchingPattern: vi.fn(),
	switchToBranch: vi.fn(),
	deleteLocalBranch: vi.fn(),
}));

vi.mock("../utils/version-updater.js", () => ({
	updateMultipleProjectVersions: vi.fn(),
	getPackageName: vi.fn(),
}));

vi.mock("../utils/github.js", () => ({
	checkPrExists: vi.fn(),
	getCurrentPrUrl: vi.fn(),
	mergePullRequest: vi.fn(),
}));

import {
	type Config,
	checkInitialized,
	deleteBranchInfo,
	loadBranchInfo,
	loadConfig,
} from "../utils/config.js";
import {
	commitChanges,
	deleteLocalBranch,
	getCurrentBranch,
	getTagsMatchingPattern,
	pushChanges,
	switchToBranch,
} from "../utils/git.js";
import {
	checkPrExists,
	getCurrentPrUrl,
	mergePullRequest,
} from "../utils/github.js";
import {
	getPackageName,
	updateMultipleProjectVersions,
} from "../utils/version-updater.js";

// Mock typed functions
const mockCheckInitialized = vi.mocked(checkInitialized);
const mockLoadConfig = vi.mocked(loadConfig);
const mockLoadBranchInfo = vi.mocked(loadBranchInfo);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockDeleteBranchInfo = vi.mocked(deleteBranchInfo);
const mockCommitChanges = vi.mocked(commitChanges);
const mockPushChanges = vi.mocked(pushChanges);
const mockUpdateMultipleProjectVersions = vi.mocked(
	updateMultipleProjectVersions,
);
const mockCheckPrExists = vi.mocked(checkPrExists);
const mockGetCurrentPrUrl = vi.mocked(getCurrentPrUrl);
const mockMergePullRequest = vi.mocked(mergePullRequest);
const mockGetTagsMatchingPattern = vi.mocked(getTagsMatchingPattern);
const mockSwitchToBranch = vi.mocked(switchToBranch);
const mockDeleteLocalBranch = vi.mocked(deleteLocalBranch);
const mockGetPackageName = vi.mocked(getPackageName);

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
			alpha: {
				versionSuffixStrategy: "timestamp",
				next: "rc",
			},
			rc: {
				versionSuffixStrategy: "increment",
				next: "stable",
			},
		},
	],
	projects: [
		{
			path: "package-a",
			type: "npm",
			baseVersion: "1.0.0",
			deps: ["package.json"],
			registries: ["npm"],
		},
		{
			path: "package-b",
			type: "npm",
			baseVersion: "2.1.0",
			deps: ["package.json"],
			registries: ["npm"],
		},
	],
};

const mockBranchInfo = {
	tag: "alpha",
	parentBranch: "main",
	workspaceUpdated: {
		"package-a": "1.0.1-alpha.20231225103045",
		"package-b": "2.1.1-alpha.20231225103045",
	},
};

describe("endPrCommand", () => {
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
		mockCheckPrExists.mockResolvedValue(true);
		mockGetCurrentPrUrl.mockResolvedValue(
			"https://github.com/test/repo/pull/123",
		);
		mockDeleteBranchInfo.mockResolvedValue(undefined);
		mockCommitChanges.mockResolvedValue(undefined);
		mockPushChanges.mockResolvedValue(undefined);
		mockSwitchToBranch.mockResolvedValue(undefined);
		mockDeleteLocalBranch.mockResolvedValue(undefined);
		mockGetPackageName.mockImplementation(async (path: string) => {
			if (path === "package-b") return "package-b";
			return "package-a";
		});
		mockUpdateMultipleProjectVersions.mockResolvedValue(undefined);
		mockMergePullRequest.mockResolvedValue(undefined);
		mockGetTagsMatchingPattern.mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization checks", () => {
		it("should display error and exit if not initialized", async () => {
			mockCheckInitialized.mockResolvedValue(false);

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ cd-tools has not been initialized. Run 'cd-tools init' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if config loading fails", async () => {
			mockLoadConfig.mockRejectedValue(new Error("Config not found"));

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ Failed to load configuration: Config not found",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if branch info not found", async () => {
			mockLoadBranchInfo.mockResolvedValue(null);

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ No branch info found. Run 'cd-tools start-pr' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if PR not found", async () => {
			mockCheckPrExists.mockResolvedValue(false);

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ No pull request found. Run 'cd-tools push-pr' first.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if PR URL not found", async () => {
			mockGetCurrentPrUrl.mockResolvedValue(null);

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				"❌ Could not get pull request URL.",
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});
	});

	describe("successful flow", () => {
		it("should complete end-pr command successfully with next version updates", async () => {
			// Allow console output for this test
			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");

			// Mock Date for predictable timestamp
			const mockDate = new Date("2023-12-25T10:30:45.123Z");
			vi.setSystemTime(mockDate);

			await endPrCommand();

			// Verify key function calls
			expect(mockCheckInitialized).toHaveBeenCalled();
			expect(mockLoadConfig).toHaveBeenCalled();
			expect(mockGetCurrentBranch).toHaveBeenCalled();
			expect(mockLoadBranchInfo).toHaveBeenCalled();
			expect(mockCheckPrExists).toHaveBeenCalled();
			expect(mockGetCurrentPrUrl).toHaveBeenCalled();

			// Should update versions for next tag
			expect(mockUpdateMultipleProjectVersions).toHaveBeenCalled();
			expect(mockCommitChanges).toHaveBeenCalledWith(
				"prepare next release: package-a(1.0.0-rc.0), package-b(2.1.0-rc.0)",
			);

			// Should clean up and merge
			expect(mockDeleteBranchInfo).toHaveBeenCalledWith("feat/test(alpha)");
			expect(mockCommitChanges).toHaveBeenCalledWith(
				"cleanup: remove branch info file",
			);
			expect(mockMergePullRequest).toHaveBeenCalledWith(
				"https://github.com/test/repo/pull/123",
			);

			// Should switch back to parent branch and delete feature branch
			expect(mockSwitchToBranch).toHaveBeenCalledWith("main");
			expect(mockDeleteLocalBranch).toHaveBeenCalledWith("feat/test(alpha)");

			// Check console output
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🏁 Finalizing and merging PR...",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"📂 Current branch: feat/test(alpha)",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith("🏷️  Release mode: alpha");
			expect(consoleLogSpy).toHaveBeenCalledWith("📁 Parent branch: main");
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"📈 Updating to next version tag: rc",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✅ End PR completed successfully!",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle case with no next version configured", async () => {
			// Config without next field
			const configWithoutNext = {
				...mockConfig,
				versionTags: [
					{
						alpha: {
							versionSuffixStrategy: "timestamp" as const,
						},
					},
				],
			};
			mockLoadConfig.mockResolvedValue(configWithoutNext);

			// Allow console output for this test
			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");

			await endPrCommand();

			// Should not call version updates
			expect(mockUpdateMultipleProjectVersions).not.toHaveBeenCalled();

			// Should still clean up and merge
			expect(mockDeleteBranchInfo).toHaveBeenCalled();
			expect(mockMergePullRequest).toHaveBeenCalled();

			// Should switch back to parent branch and delete feature branch
			expect(mockSwitchToBranch).toHaveBeenCalledWith("main");
			expect(mockDeleteLocalBranch).toHaveBeenCalledWith("feat/test(alpha)");

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✨ No next version configured, skipping version updates",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle case with no workspaceUpdated", async () => {
			const branchInfoWithoutWorkspace = {
				tag: "alpha",
				parentBranch: "main",
			};
			mockLoadBranchInfo.mockResolvedValue(branchInfoWithoutWorkspace);

			await endPrCommand();

			// Should not call version updates
			expect(mockUpdateMultipleProjectVersions).not.toHaveBeenCalled();

			// Should still clean up and merge
			expect(mockDeleteBranchInfo).toHaveBeenCalled();
			expect(mockMergePullRequest).toHaveBeenCalled();

			// Should switch back to parent branch and delete feature branch
			expect(mockSwitchToBranch).toHaveBeenCalledWith("main");
			expect(mockDeleteLocalBranch).toHaveBeenCalledWith("feat/test(alpha)");
		});
	});
});
