import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endPrCommand } from "./end-pr.js";

// Mock all external dependencies
vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
	unlink: vi.fn(),
}));

vi.mock("../config/parser.js", () => ({
	loadConfig: vi.fn(),
}));

vi.mock("../fs/utils.js", () => ({
	readFileContent: vi.fn(),
	updatePackageVersion: vi.fn(),
	updateCargoVersion: vi.fn(),
}));

vi.mock("../git/github.js", () => ({
	GitHubError: class GitHubError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "GitHubError";
		}
	},
	createRelease: vi.fn(),
	getPRStatus: vi.fn(),
	mergePullRequest: vi.fn(),
}));

vi.mock("../git/operations.js", () => ({
	commitChanges: vi.fn(),
	pushChanges: vi.fn(),
}));

vi.mock("../interactive/prompts.js", () => ({
	askChoice: vi.fn(),
	askYesNo: vi.fn(),
}));

// Import mocked modules for type checking
import { readdir, unlink } from "node:fs/promises";
import { loadConfig } from "../config/parser.js";
import { readFileContent } from "../fs/utils.js";
import {
	GitHubError,
	createRelease,
	getPRStatus,
	mergePullRequest,
} from "../git/github.js";
import { commitChanges, pushChanges } from "../git/operations.js";
import { askChoice, askYesNo } from "../interactive/prompts.js";

describe("endPrCommand", () => {
	const mockConfig = {
		baseVersion: "1.0.0",
		versionTags: [
			{
				rc: {
					versionSuffixStrategy: "increment",
					next: "stable",
				},
			},
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
			{
				path: "./backend",
				type: "rust",
				registries: ["crates"],
			},
		],
		releaseNotes: {
			enabled: true,
			template: "## Changes\\n\\n{{changes}}",
		},
	};

	const mockTrackingData = {
		tag: "rc",
		branch: "rc/feat/test",
		baseVersion: "1.0.0",
		currentVersion: "1.0.1-rc.1",
		releasedWorkspaces: {
			"./frontend": "1.0.1-rc.1",
			"./backend": "1.0.1-rc.1",
		},
	};

	const mockPRStatus = {
		state: "open",
		mergeable: true,
		checks: [
			{ name: "test", status: "SUCCESS" },
			{ name: "lint", status: "SUCCESS" },
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		console.log = vi.fn();
		console.error = vi.fn();
		console.warn = vi.fn();

		// Default mocks
		vi.mocked(loadConfig).mockResolvedValue(mockConfig);
		// biome-ignore lint/suspicious/noExplicitAny: Required due to readdir type mismatch between string[] and Dirent[]
		vi.mocked(readdir).mockResolvedValue(["rc_feat_test.json"] as any);
		vi.mocked(readFileContent).mockResolvedValue(
			JSON.stringify(mockTrackingData),
		);
		vi.mocked(getPRStatus).mockResolvedValue(mockPRStatus);
		vi.mocked(askChoice).mockResolvedValue("squash");
		vi.mocked(askYesNo).mockResolvedValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("successful end-pr workflow", () => {
		it("should complete end-pr with stable release", async () => {
			await endPrCommand();

			// Should load config and find tracking file
			expect(loadConfig).toHaveBeenCalledOnce();
			expect(readdir).toHaveBeenCalledWith(".cdtools");

			// Should read and parse tracking data
			expect(readFileContent).toHaveBeenCalledWith(".cdtools/rc_feat_test.json");

			// Should create stable release when next is "stable"
			expect(commitChanges).toHaveBeenCalledWith(
				expect.stringContaining("chore: release stable 1.0.0"),
			);
			expect(pushChanges).toHaveBeenCalledTimes(2); // stable release + cleanup

			// Should check PR status and merge
			expect(getPRStatus).toHaveBeenCalledOnce();
			expect(askChoice).toHaveBeenCalledWith(
				"Select merge method:",
				expect.arrayContaining([
					{ name: "Squash and merge (recommended)", value: "squash" },
				]),
			);
			expect(mergePullRequest).toHaveBeenCalledWith("squash");

			// Should create GitHub release
			expect(askYesNo).toHaveBeenCalledWith("Create GitHub release?", true);
			expect(createRelease).toHaveBeenCalledWith(
				"v1.0.0",
				"Release 1.0.0",
				expect.stringContaining("## Release 1.0.0"),
			);

			// Should clean up tracking file
			expect(askYesNo).toHaveBeenCalledWith(
				"Delete tracking file and finalize release?",
				true,
			);
			expect(unlink).toHaveBeenCalledWith(".cdtools/rc_feat_test.json");
		});

		it("should complete end-pr without stable release when no next config", async () => {
			// Mock config without "next" property
			const configWithoutNext = {
				...mockConfig,
				versionTags: [
					{
						alpha: {
							versionSuffixStrategy: "timestamp",
						},
					},
				],
			};
			const trackingDataAlpha = {
				...mockTrackingData,
				tag: "alpha",
				currentVersion: "1.0.1-alpha.20250718120000",
			};

			vi.mocked(loadConfig).mockResolvedValue(configWithoutNext);
			vi.mocked(readFileContent).mockResolvedValue(
				JSON.stringify(trackingDataAlpha),
			);

			await endPrCommand();

			// Should not create stable release
			expect(commitChanges).toHaveBeenCalledOnce(); // only cleanup commit
			expect(pushChanges).toHaveBeenCalledOnce(); // only cleanup push

			// Should still merge PR
			expect(mergePullRequest).toHaveBeenCalledWith("squash");

			// Should not create GitHub release (not stable)
			expect(createRelease).not.toHaveBeenCalled();
		});

		it("should handle different merge methods", async () => {
			vi.mocked(askChoice).mockResolvedValue("merge");

			await endPrCommand();

			expect(mergePullRequest).toHaveBeenCalledWith("merge");
		});

		it("should skip GitHub release creation when user declines", async () => {
			vi.mocked(askYesNo).mockResolvedValueOnce(false); // decline release
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // confirm cleanup

			await endPrCommand();

			expect(createRelease).not.toHaveBeenCalled();
			expect(unlink).toHaveBeenCalledWith(".cdtools/rc_feat_test.json");
		});
	});

	describe("error handling", () => {
		it("should handle missing tracking file", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: Required due to readdir type mismatch between string[] and Dirent[]
			vi.mocked(readdir).mockResolvedValue([] as any);

			await endPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ No tracking file found. Nothing to finalize.",
			);
			expect(mergePullRequest).not.toHaveBeenCalled();
		});

		it("should handle missing version tag configuration", async () => {
			const trackingDataInvalid = {
				...mockTrackingData,
				tag: "nonexistent",
			};
			vi.mocked(readFileContent).mockResolvedValue(
				JSON.stringify(trackingDataInvalid),
			);

			await expect(endPrCommand()).rejects.toThrow(
				"Version tag configuration not found: nonexistent",
			);
		});

		it("should handle invalid tag configuration", async () => {
			const configInvalid = {
				...mockConfig,
				versionTags: [{ rc: "invalid" }],
			};
			// biome-ignore lint/suspicious/noExplicitAny: Required for mocking invalid config structure
			vi.mocked(loadConfig).mockResolvedValue(configInvalid as any);

			await expect(endPrCommand()).rejects.toThrow(
				"Invalid tag configuration for: rc",
			);
		});

		it("should handle non-mergeable PR", async () => {
			const nonMergeablePR = {
				...mockPRStatus,
				mergeable: false,
			};
			vi.mocked(getPRStatus).mockResolvedValue(nonMergeablePR);

			await endPrCommand();

			expect(console.warn).toHaveBeenCalledWith(
				"⚠️  PR is not mergeable. Please resolve conflicts first.",
			);
			expect(mergePullRequest).not.toHaveBeenCalled();
		});

		it("should handle failing CI checks with user confirmation", async () => {
			const failingPR = {
				...mockPRStatus,
				checks: [
					{ name: "test", status: "FAILURE" },
					{ name: "lint", status: "SUCCESS" },
				],
			};
			vi.mocked(getPRStatus).mockResolvedValue(failingPR);
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // proceed anyway
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // create release
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // cleanup

			await endPrCommand();

			expect(console.warn).toHaveBeenCalledWith(
				"⚠️  Some CI checks are failing:",
			);
			expect(askYesNo).toHaveBeenCalledWith(
				"Proceed with merge despite failing checks?",
				false,
			);
			expect(mergePullRequest).toHaveBeenCalledWith("squash");
		});

		it("should abort merge when user declines failing CI checks", async () => {
			const failingPR = {
				...mockPRStatus,
				checks: [{ name: "test", status: "ERROR" }],
			};
			vi.mocked(getPRStatus).mockResolvedValue(failingPR);
			vi.mocked(askYesNo).mockResolvedValueOnce(false); // don't proceed

			await endPrCommand();

			expect(console.log).toHaveBeenCalledWith(
				"❌ Merge cancelled. Fix CI issues and try again.",
			);
			expect(mergePullRequest).not.toHaveBeenCalled();
		});

		it("should handle GitHub CLI errors gracefully", async () => {
			vi.mocked(getPRStatus).mockRejectedValue(
				new GitHubError("Authentication failed"),
			);

			await endPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ GitHub CLI error: Authentication failed",
			);
			expect(console.log).toHaveBeenCalledWith(
				"💡 You can merge the PR manually in the GitHub web interface",
			);
		});

		it("should rethrow non-GitHub errors", async () => {
			const otherError = new Error("Network error");
			vi.mocked(getPRStatus).mockRejectedValue(otherError);

			await expect(endPrCommand()).rejects.toThrow("Network error");
		});

		it("should handle readdir errors for tracking file", async () => {
			vi.mocked(readdir).mockRejectedValue(new Error("Directory not found"));

			await endPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ No tracking file found. Nothing to finalize.",
			);
		});
	});

	describe("project version updates", () => {
		it("should update TypeScript project versions for stable release", async () => {
			const { updatePackageVersion } = await import("../fs/utils.js");

			await endPrCommand();

			expect(updatePackageVersion).toHaveBeenCalledWith(
				"frontend/package.json",
				"1.0.0",
			);
		});

		it("should update Rust project versions for stable release", async () => {
			const { updateCargoVersion } = await import("../fs/utils.js");

			await endPrCommand();

			expect(updateCargoVersion).toHaveBeenCalledWith(
				"backend/Cargo.toml",
				"1.0.0",
			);
		});

		it("should skip unknown project types", async () => {
			const configWithUnknown = {
				...mockConfig,
				versionTags: [
					{
						rc: {
							versionSuffixStrategy: "increment",
							next: "stable",
						},
					},
				],
				projects: [
					{
						path: "./unknown",
						type: "unknown",
						registries: ["custom"],
					},
				],
			};
			const trackingDataWithUnknown = {
				...mockTrackingData,
				releasedWorkspaces: {
					"./unknown": "1.0.1-rc.1",
				},
			};
			// biome-ignore lint/suspicious/noExplicitAny: Required for mocking config with unknown project type
			vi.mocked(loadConfig).mockResolvedValue(configWithUnknown as any);
			vi.mocked(readFileContent).mockResolvedValue(
				JSON.stringify(trackingDataWithUnknown),
			);

			await endPrCommand();

			expect(console.log).toHaveBeenCalledWith(
				"⚠️  Unknown project type: unknown, skipping version update",
			);
		});
	});

	describe("cleanup behavior", () => {
		it("should skip cleanup when user declines", async () => {
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // create release
			vi.mocked(askYesNo).mockResolvedValueOnce(false); // decline cleanup

			await endPrCommand();

			expect(unlink).not.toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith(
				"✅ End PR completed successfully!",
			);
		});

		it("should perform cleanup when user confirms", async () => {
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // create release
			vi.mocked(askYesNo).mockResolvedValueOnce(true); // confirm cleanup

			await endPrCommand();

			expect(unlink).toHaveBeenCalledWith(".cdtools/rc_feat_test.json");
			expect(commitChanges).toHaveBeenCalledWith(
				"chore: cleanup release tracking file",
			);
			expect(console.log).toHaveBeenCalledWith("🧹 Cleaned up tracking file");
		});
	});

	describe("release notes generation", () => {
		it("should generate proper release notes for stable release", async () => {
			await endPrCommand();

			expect(createRelease).toHaveBeenCalledWith(
				"v1.0.0",
				"Release 1.0.0",
				expect.stringContaining("## Release 1.0.0"),
			);

			const releaseBody = vi.mocked(createRelease).mock.calls[0]?.[2];
			expect(releaseBody).toContain("### Updated Projects");
			expect(releaseBody).toContain("- ./frontend");
			expect(releaseBody).toContain("- ./backend");
			expect(releaseBody).toContain("version 1.0.0");
			expect(releaseBody).toContain(
				"*This release was created automatically by cd-tools*",
			);
		});
	});
});