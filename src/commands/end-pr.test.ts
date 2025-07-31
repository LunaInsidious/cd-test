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
		deleteBranchInfo: vi.fn(),
		loadBranchInfo: vi.fn(),
		loadConfig: vi.fn(),
		updateBranchInfo: vi.fn(),
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

vi.mock("prompts", () => ({
	default: vi.fn(),
}));

import prompts from "prompts";
import {
	type Config,
	deleteBranchInfo,
	loadBranchInfo,
	loadConfig,
	updateBranchInfo,
	updateConfig,
} from "../utils/config.js";
import { NotFoundError } from "../utils/error.js";
import {
	commitChanges,
	deleteLocalBranch,
	getCurrentBranch,
	getTagsMatchingPattern,
	pushChanges,
	switchToBranch,
} from "../utils/git.js";
import { getCurrentPrUrl, mergePullRequest } from "../utils/github.js";
import {
	getPackageName,
	updateMultipleProjectVersions,
} from "../utils/version-updater.js";

// Mock typed functions
const mockLoadConfig = vi.mocked(loadConfig);
const mockLoadBranchInfo = vi.mocked(loadBranchInfo);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockDeleteBranchInfo = vi.mocked(deleteBranchInfo);
const mockUpdateBranchInfo = vi.mocked(updateBranchInfo);
const mockUpdateConfig = vi.mocked(updateConfig);
const mockCommitChanges = vi.mocked(commitChanges);
const mockPushChanges = vi.mocked(pushChanges);
const mockUpdateMultipleProjectVersions = vi.mocked(
	updateMultipleProjectVersions,
);
const mockGetCurrentPrUrl = vi.mocked(getCurrentPrUrl);
const mockMergePullRequest = vi.mocked(mergePullRequest);
const mockGetTagsMatchingPattern = vi.mocked(getTagsMatchingPattern);
const mockSwitchToBranch = vi.mocked(switchToBranch);
const mockDeleteLocalBranch = vi.mocked(deleteLocalBranch);
const mockGetPackageName = vi.mocked(getPackageName);
const mockPrompts = vi.mocked(prompts);

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
			type: "typescript" as const,
			baseVersion: "1.0.0",
			deps: ["package.json"],
			registries: ["npm"],
		},
		{
			path: "package-b",
			type: "typescript" as const,
			baseVersion: "2.1.0",
			deps: ["package.json"],
			registries: ["npm"],
		},
	],
};

const mockBranchInfo = {
	tag: "alpha",
	parentBranch: "main",
	projectUpdated: {
		"package-a": {
			version: "1.0.1-alpha.20231225103045",
			updatedAt: "2023-12-25T10:30:45.123Z",
		},
		"package-b": {
			version: "2.1.1-alpha.20231225103045",
			updatedAt: "2023-12-25T10:30:45.123Z",
		},
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
		mockLoadConfig.mockResolvedValue(mockConfig);
		mockGetCurrentBranch.mockResolvedValue("feat/test(alpha)");
		mockLoadBranchInfo.mockResolvedValue(mockBranchInfo);
		mockGetCurrentPrUrl.mockResolvedValue(
			"https://github.com/test/repo/pull/123",
		);
		mockDeleteBranchInfo.mockResolvedValue(undefined);
		mockUpdateBranchInfo.mockResolvedValue(undefined);
		mockUpdateConfig.mockResolvedValue(undefined);
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
		// Default to confirming merge
		mockPrompts.mockResolvedValue({ confirm: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initialization checks", () => {
		it("should display error and exit if not initialized", async () => {
			mockLoadConfig.mockRejectedValue(new NotFoundError("Config not found"));

			await expect(endPrCommand()).rejects.toThrow(
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

			await expect(endPrCommand()).rejects.toThrow(
				"process.exit() called with code 1",
			);

			expect(mockConsoleError).toHaveBeenCalledWith(
				'❌ Branch info not found for "feat/test(alpha)". Run "cd-tools start-pr" first.',
			);
			expect(mockProcessExit).toHaveBeenCalledWith(1);
		});

		it("should display error and exit if PR not found", async () => {
			mockGetCurrentPrUrl.mockResolvedValue(null);

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
				"❌ No pull request found. Run 'cd-tools push-pr' first.",
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
			expect(mockLoadConfig).toHaveBeenCalled();
			expect(mockGetCurrentBranch).toHaveBeenCalled();
			expect(mockLoadBranchInfo).toHaveBeenCalled();
			expect(mockGetCurrentPrUrl).toHaveBeenCalled();
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

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✨ No next version configured, skipping version updates",
			);

			consoleLogSpy.mockRestore();
		});

		it("should handle case with no projectUpdated", async () => {
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
		});

		it("should exit without merging when user declines confirmation", async () => {
			// User declines merge
			mockPrompts.mockResolvedValue({ confirm: false });

			// Allow console output for this test
			mockConsoleLog.mockRestore();
			const consoleLogSpy = vi.spyOn(console, "log");

			await endPrCommand();

			// Should not merge or clean up
			expect(mockMergePullRequest).not.toHaveBeenCalled();
			expect(mockDeleteBranchInfo).not.toHaveBeenCalled();
			expect(mockSwitchToBranch).not.toHaveBeenCalled();
			expect(mockDeleteLocalBranch).not.toHaveBeenCalled();
			expect(mockUpdateMultipleProjectVersions).not.toHaveBeenCalled();

			expect(consoleLogSpy).toHaveBeenCalledWith("❌ Merge cancelled.");

			consoleLogSpy.mockRestore();
		});
	});
});
