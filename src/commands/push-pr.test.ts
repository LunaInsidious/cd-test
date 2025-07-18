import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushPrCommand } from "./push-pr.js";

// Mock all external dependencies
vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
}));

vi.mock("../config/parser.js", () => ({
	loadConfig: vi.fn(),
}));

vi.mock("../fs/utils.js", () => ({
	readFileContent: vi.fn(),
	updatePackageVersion: vi.fn(),
	updateCargoVersion: vi.fn(),
	writeFile: vi.fn(),
}));

vi.mock("../git/github.js", () => ({
	GitHubError: class GitHubError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "GitHubError";
		}
	},
	checkExistingPR: vi.fn(),
	createPullRequest: vi.fn(),
	updatePullRequest: vi.fn(),
}));

vi.mock("../git/operations.js", () => ({
	commitChanges: vi.fn(),
	getChangedFiles: vi.fn(),
	pushChanges: vi.fn(),
}));

vi.mock("../interactive/prompts.js", () => ({
	askYesNo: vi.fn(),
}));

vi.mock("../version/calculator.js", () => ({
	calculateNextVersion: vi.fn(),
}));

// Import mocked modules for type checking
import { readdir } from "node:fs/promises";
import { loadConfig } from "../config/parser.js";
import {
	readFileContent,
	updateCargoVersion,
	updatePackageVersion,
	writeFile,
} from "../fs/utils.js";
import {
	GitHubError,
	checkExistingPR,
	createPullRequest,
	updatePullRequest,
} from "../git/github.js";
import {
	commitChanges,
	getChangedFiles,
	pushChanges,
} from "../git/operations.js";
import { askYesNo } from "../interactive/prompts.js";
import { calculateNextVersion } from "../version/calculator.js";

describe("pushPrCommand", () => {
	const mockConfig = {
		baseVersion: "1.0.0",
		versionTags: [
			{
				rc: {
					versionSuffixStrategy: "increment" as const,
				},
			},
			{
				alpha: {
					versionSuffixStrategy: "timestamp" as const,
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
			template: "## Changes\n\n{{changes}}",
		},
	};

	const mockTrackingData = {
		tag: "rc",
		branch: "rc/feat/test",
		baseVersion: "1.0.0",
		currentVersion: "1.0.1-rc.0",
		releasedWorkspaces: {
			"./frontend": "1.0.1-rc.0",
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		console.log = vi.fn();
		console.error = vi.fn();

		// Default mocks
		vi.mocked(loadConfig).mockResolvedValue(mockConfig);
		vi.mocked(readdir).mockResolvedValue(["rc_feat_test.json"]);
		vi.mocked(readFileContent).mockResolvedValue(
			JSON.stringify(mockTrackingData),
		);
		vi.mocked(getChangedFiles).mockResolvedValue([
			"frontend/src/app.ts",
			"backend/src/main.rs",
		]);
		vi.mocked(calculateNextVersion).mockReturnValue("1.0.1-rc.1");
		vi.mocked(askYesNo).mockResolvedValue(true);
		vi.mocked(checkExistingPR).mockResolvedValue(null);
		vi.mocked(createPullRequest).mockResolvedValue(
			"https://github.com/user/repo/pull/42",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("successful push-pr workflow", () => {
		it("should complete push-pr with version updates and PR creation", async () => {
			await pushPrCommand();

			// Should load config and find tracking file
			expect(loadConfig).toHaveBeenCalledOnce();
			expect(readdir).toHaveBeenCalledWith(".cdtools");
			expect(readFileContent).toHaveBeenCalledWith(".cdtools/rc_feat_test.json");

			// Should get changed files and calculate next version
			expect(getChangedFiles).toHaveBeenCalledWith("main");
			expect(calculateNextVersion).toHaveBeenCalledWith(
				"1.0.0",
				"rc",
				"increment",
				"1.0.1-rc.0",
			);

			// Should update project versions
			expect(updatePackageVersion).toHaveBeenCalledWith(
				"frontend/package.json",
				"1.0.1-rc.1",
			);
			expect(updateCargoVersion).toHaveBeenCalledWith(
				"backend/Cargo.toml",
				"1.0.1-rc.1",
			);

			// Should commit and push changes
			expect(commitChanges).toHaveBeenCalledWith(
				expect.stringContaining("chore: release 1.0.1-rc.1"),
			);
			expect(pushChanges).toHaveBeenCalledOnce();

			// Should create PR
			expect(askYesNo).toHaveBeenCalledWith("Create GitHub PR?", true);
			expect(createPullRequest).toHaveBeenCalledWith(
				"Release 1.0.1-rc.1",
				expect.stringContaining("## Release 1.0.1-rc.1"),
			);
		});

		it("should update existing PR when one exists", async () => {
			vi.mocked(checkExistingPR).mockResolvedValue(
				"https://github.com/user/repo/pull/42",
			);

			await pushPrCommand();

			expect(updatePullRequest).toHaveBeenCalledWith(
				"Release 1.0.1-rc.1",
				expect.stringContaining("## Release 1.0.1-rc.1"),
			);
			expect(createPullRequest).not.toHaveBeenCalled();
		});

		it("should skip PR creation when user declines", async () => {
			vi.mocked(askYesNo).mockResolvedValue(false);

			await pushPrCommand();

			expect(createPullRequest).not.toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith(
				"✅ Push PR completed successfully!",
			);
		});

		it("should handle projects with no changes", async () => {
			vi.mocked(getChangedFiles).mockResolvedValue([]);

			await pushPrCommand();

			// Should still complete successfully but with no affected projects
			expect(console.log).toHaveBeenCalledWith("📂 Found 0 affected projects:");
			expect(updatePackageVersion).not.toHaveBeenCalled();
			expect(updateCargoVersion).not.toHaveBeenCalled();
		});

		it("should handle timestamp version strategy", async () => {
			const trackingDataAlpha = {
				...mockTrackingData,
				tag: "alpha",
			};
			vi.mocked(readFileContent).mockResolvedValue(
				JSON.stringify(trackingDataAlpha),
			);
			vi.mocked(calculateNextVersion).mockReturnValue(
				"1.0.1-alpha.20250718120000",
			);

			await pushPrCommand();

			expect(calculateNextVersion).toHaveBeenCalledWith(
				"1.0.0",
				"alpha",
				"timestamp",
				"1.0.1-rc.0",
			);
		});
	});

	describe("error handling", () => {
		it("should handle missing tracking file", async () => {
			vi.mocked(readdir).mockResolvedValue([]);

			await pushPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ No tracking file found. Run 'cd-tools start-pr' first.",
			);
			expect(calculateNextVersion).not.toHaveBeenCalled();
		});

		it("should handle missing version tag configuration", async () => {
			const trackingDataInvalid = {
				...mockTrackingData,
				tag: "nonexistent",
			};
			vi.mocked(readFileContent).mockResolvedValue(
				JSON.stringify(trackingDataInvalid),
			);

			await expect(pushPrCommand()).rejects.toThrow(
				"Version tag configuration not found: nonexistent",
			);
		});

		it("should handle invalid tag configuration", async () => {
			const configInvalid = {
				...mockConfig,
				versionTags: [{ rc: "invalid" }],
			};
			vi.mocked(loadConfig).mockResolvedValue(configInvalid);

			await expect(pushPrCommand()).rejects.toThrow(
				"Invalid tag configuration for: rc",
			);
		});

		it("should handle GitHub CLI errors gracefully", async () => {
			vi.mocked(createPullRequest).mockRejectedValue(
				new GitHubError("Authentication failed"),
			);

			await pushPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ GitHub CLI error: Authentication failed",
			);
			expect(console.log).toHaveBeenCalledWith(
				"💡 You can create the PR manually or fix the GitHub CLI setup",
			);
		});

		it("should rethrow non-GitHub errors", async () => {
			const otherError = new Error("Network error");
			vi.mocked(createPullRequest).mockRejectedValue(otherError);

			await expect(pushPrCommand()).rejects.toThrow("Network error");
		});

		it("should handle readdir errors for tracking file", async () => {
			vi.mocked(readdir).mockRejectedValue(new Error("Directory not found"));

			await pushPrCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ No tracking file found. Run 'cd-tools start-pr' first.",
			);
		});
	});

	describe("project version updates", () => {
		it("should update TypeScript project versions", async () => {
			await pushPrCommand();

			expect(updatePackageVersion).toHaveBeenCalledWith(
				"frontend/package.json",
				"1.0.1-rc.1",
			);
		});

		it("should update Rust project versions", async () => {
			await pushPrCommand();

			expect(updateCargoVersion).toHaveBeenCalledWith(
				"backend/Cargo.toml",
				"1.0.1-rc.1",
			);
		});

		it("should skip unknown project types", async () => {
			const configWithUnknown = {
				...mockConfig,
				projects: [
					{
						path: "./unknown",
						type: "unknown",
						registries: ["custom"],
					},
				],
			};
			vi.mocked(loadConfig).mockResolvedValue(configWithUnknown);
			vi.mocked(getChangedFiles).mockResolvedValue(["unknown/file.txt"]);

			await pushPrCommand();

			expect(console.log).toHaveBeenCalledWith(
				"⚠️  Unknown project type: unknown, skipping version update",
			);
		});

		it("should update tracking data with new version", async () => {
			await pushPrCommand();

			expect(writeFile).toHaveBeenCalledWith(
				".cdtools/rc_feat_test.json",
				expect.stringContaining('"currentVersion":"1.0.1-rc.1"'),
			);
		});
	});

	describe("affected projects detection", () => {
		it("should detect affected projects based on changed files", async () => {
			vi.mocked(getChangedFiles).mockResolvedValue([
				"frontend/src/app.ts",
				"docs/README.md", // non-project file
			]);

			await pushPrCommand();

			expect(console.log).toHaveBeenCalledWith("📂 Found 1 affected projects:");
			expect(console.log).toHaveBeenCalledWith("  - ./frontend (typescript)");
		});

		it("should handle files with ./ prefix matching", async () => {
			vi.mocked(getChangedFiles).mockResolvedValue(["./frontend/src/app.ts"]);

			await pushPrCommand();

			expect(updatePackageVersion).toHaveBeenCalledWith(
				"frontend/package.json",
				"1.0.1-rc.1",
			);
		});

		it("should handle nested project paths", async () => {
			const configWithNested = {
				...mockConfig,
				projects: [
					{
						path: "./packages/ui",
						type: "typescript",
						registries: ["npm"],
					},
				],
			};
			vi.mocked(loadConfig).mockResolvedValue(configWithNested);
			vi.mocked(getChangedFiles).mockResolvedValue(["packages/ui/src/index.ts"]);

			await pushPrCommand();

			expect(updatePackageVersion).toHaveBeenCalledWith(
				"packages/ui/package.json",
				"1.0.1-rc.1",
			);
		});
	});

	describe("PR body generation", () => {
		it("should generate comprehensive PR body", async () => {
			await pushPrCommand();

			const expectedBody = expect.stringContaining("## Release 1.0.1-rc.1");
			expect(createPullRequest).toHaveBeenCalledWith(
				"Release 1.0.1-rc.1",
				expectedBody,
			);

			// Get the actual body from the mock call
			const actualBody = vi.mocked(createPullRequest).mock.calls[0]?.[1];
			expect(actualBody).toContain("### Updated Projects");
			expect(actualBody).toContain("- **./frontend** (typescript) → 1.0.1-rc.1");
			expect(actualBody).toContain("- **./backend** (rust) → 1.0.1-rc.1");
			expect(actualBody).toContain("### Registry Deployments");
			expect(actualBody).toContain("- npm");
			expect(actualBody).toContain("- crates");
			expect(actualBody).toContain(
				"*This PR was created automatically by cd-tools*",
			);
		});

		it("should deduplicate registries in PR body", async () => {
			const configWithDuplicates = {
				...mockConfig,
				projects: [
					{
						path: "./frontend",
						type: "typescript",
						registries: ["npm"],
					},
					{
						path: "./admin",
						type: "typescript",
						registries: ["npm"], // duplicate registry
					},
				],
			};
			vi.mocked(loadConfig).mockResolvedValue(configWithDuplicates);
			vi.mocked(getChangedFiles).mockResolvedValue([
				"frontend/src/app.ts",
				"admin/src/app.ts",
			]);

			await pushPrCommand();

			const actualBody = vi.mocked(createPullRequest).mock.calls[0]?.[1];
			// Should only show npm once
			const npmMatches = (actualBody?.match(/- npm/g) || []).length;
			expect(npmMatches).toBe(1);
		});
	});
});