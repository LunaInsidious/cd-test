import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock exec completely to prevent any actual command execution
const mockExec = vi.fn();

vi.mock("node:child_process", () => ({
	exec: mockExec,
}));

vi.mock("node:util", () => ({
	promisify: (fn: any) => {
		if (fn === mockExec) {
			return mockExec;
		}
		return fn;
	},
}));

// Import after mocking
import {
	GitHubError,
	checkGitHubCLI,
	createPullRequest,
	checkExistingPR,
	updatePullRequest,
	mergePullRequest,
	getPRStatus,
	createRelease,
} from "./github.js";

describe("git/github", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("GitHubError", () => {
		it("should create error with message and exit code", () => {
			const error = new GitHubError("Test error", 1);
			expect(error.message).toBe("Test error");
			expect(error.exitCode).toBe(1);
			expect(error.name).toBe("GitHubError");
		});

		it("should create error with just message", () => {
			const error = new GitHubError("Test error");
			expect(error.message).toBe("Test error");
			expect(error.exitCode).toBeUndefined();
		});
	});

	describe("checkGitHubCLI", () => {
		it("should pass when gh is installed and authenticated", async () => {
			// Mock successful gh --version
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			// Mock successful gh auth status
			mockExec.mockResolvedValueOnce({ stdout: "Logged in to github.com", stderr: "" });

			await expect(checkGitHubCLI()).resolves.toBeUndefined();
			expect(mockExec).toHaveBeenCalledTimes(2);
		});

		it("should throw GitHubError when gh is not installed", async () => {
			mockExec.mockRejectedValueOnce(new Error("Command not found"));

			await expect(checkGitHubCLI()).rejects.toThrow(GitHubError);
			await expect(checkGitHubCLI()).rejects.toThrow("GitHub CLI (gh) is not installed");
		});

		it("should throw GitHubError when gh is not authenticated", async () => {
			// Mock successful gh --version
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			// Mock failed gh auth status
			mockExec.mockRejectedValueOnce(new Error("Not authenticated"));

			await expect(checkGitHubCLI()).rejects.toThrow(GitHubError);
			await expect(checkGitHubCLI()).rejects.toThrow("GitHub CLI is not authenticated");
		});
	});

	describe("createPullRequest", () => {
		it("should create PR and return URL", async () => {
			const mockOutput = "https://github.com/user/repo/pull/123\n";
			
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR creation
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await createPullRequest("Release v1.0.0", "Test PR body");
			expect(result).toBe("https://github.com/user/repo/pull/123");
		});

		it("should handle custom base branch", async () => {
			const mockOutput = "https://github.com/user/repo/pull/124\n";
			
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR creation with custom base
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			await createPullRequest("Test PR", "Test body", "develop");
			expect(mockExec).toHaveBeenLastCalledWith('gh pr create --title "Test PR" --body "Test body" --base "develop"');
		});

		it("should return stdout if no URL found", async () => {
			const mockOutput = "PR created successfully but no URL found\n";
			
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR creation
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await createPullRequest("Test PR", "Test body");
			expect(result).toBe("PR created successfully but no URL found");
		});

		it("should throw GitHubError on failure", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR creation failure
			mockExec.mockRejectedValueOnce(new Error("PR creation failed"));

			await expect(createPullRequest("Test PR", "Test body")).rejects.toThrow(GitHubError);
			await expect(createPullRequest("Test PR", "Test body")).rejects.toThrow("Failed to create PR");
		});
	});

	describe("checkExistingPR", () => {
		it("should return PR URL if exists", async () => {
			const mockOutput = '{"url": "https://github.com/user/repo/pull/123"}';
			
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR view
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await checkExistingPR();
			expect(result).toBe("https://github.com/user/repo/pull/123");
		});

		it("should return null if no PR exists", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR view failure
			mockExec.mockRejectedValueOnce(new Error("No pull request found"));

			const result = await checkExistingPR();
			expect(result).toBeNull();
		});
	});

	describe("updatePullRequest", () => {
		it("should update PR title and body", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR update
			mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });

			await expect(updatePullRequest("Updated Title", "Updated Body")).resolves.toBeUndefined();
			expect(mockExec).toHaveBeenLastCalledWith('gh pr edit --title "Updated Title" --body "Updated Body"');
		});

		it("should throw GitHubError on failure", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR update failure
			mockExec.mockRejectedValueOnce(new Error("Update failed"));

			await expect(updatePullRequest("Title", "Body")).rejects.toThrow(GitHubError);
			await expect(updatePullRequest("Title", "Body")).rejects.toThrow("Failed to update PR");
		});
	});

	describe("mergePullRequest", () => {
		it("should merge PR with squash method by default", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR merge
			mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });

			await expect(mergePullRequest()).resolves.toBeUndefined();
			expect(mockExec).toHaveBeenLastCalledWith('gh pr merge --squash --delete-branch');
		});

		it("should merge PR with specified method", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR merge
			mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });

			await expect(mergePullRequest("rebase")).resolves.toBeUndefined();
			expect(mockExec).toHaveBeenLastCalledWith('gh pr merge --rebase --delete-branch');
		});

		it("should throw GitHubError on merge failure", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR merge failure
			mockExec.mockRejectedValueOnce(new Error("Merge failed"));

			await expect(mergePullRequest()).rejects.toThrow(GitHubError);
			await expect(mergePullRequest()).rejects.toThrow("Failed to merge PR");
		});
	});

	describe("getPRStatus", () => {
		it("should return PR status information", async () => {
			const mockOutput = JSON.stringify({
				mergeable: "MERGEABLE",
				state: "OPEN",
				statusCheckRollupStates: [
					{ context: "ci/build", state: "SUCCESS" },
					{ context: "ci/test", state: "PENDING" },
				],
			});

			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR status
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await getPRStatus();
			expect(result).toEqual({
				mergeable: true,
				state: "OPEN",
				checks: [
					{ name: "ci/build", status: "SUCCESS" },
					{ name: "ci/test", status: "PENDING" },
				],
			});
		});

		it("should handle non-mergeable PR", async () => {
			const mockOutput = JSON.stringify({
				mergeable: "CONFLICTING",
				state: "OPEN",
				statusCheckRollupStates: [],
			});

			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock PR status
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await getPRStatus();
			expect(result.mergeable).toBe(false);
		});

		it("should throw GitHubError on failure", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock status check failure
			mockExec.mockRejectedValueOnce(new Error("Status check failed"));

			await expect(getPRStatus()).rejects.toThrow(GitHubError);
			await expect(getPRStatus()).rejects.toThrow("Failed to get PR status");
		});
	});

	describe("createRelease", () => {
		it("should create release and return URL", async () => {
			const mockOutput = "https://github.com/user/repo/releases/tag/v1.0.0\n";

			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock release creation
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await createRelease("v1.0.0", "Release v1.0.0", "Release notes");
			expect(result).toBe("https://github.com/user/repo/releases/tag/v1.0.0");
		});

		it("should create prerelease when specified", async () => {
			const mockOutput = "https://github.com/user/repo/releases/tag/v1.0.0-rc.1\n";

			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock prerelease creation
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await createRelease("v1.0.0-rc.1", "RC Release", "RC notes", true);
			expect(result).toBe("https://github.com/user/repo/releases/tag/v1.0.0-rc.1");
			expect(mockExec).toHaveBeenLastCalledWith(
				'gh release create "v1.0.0-rc.1" --title "RC Release" --notes "RC notes" --prerelease'
			);
		});

		it("should return stdout if no URL found", async () => {
			const mockOutput = "Release created successfully\n";

			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock release creation
			mockExec.mockResolvedValueOnce({ stdout: mockOutput, stderr: "" });

			const result = await createRelease("v1.0.0", "Release", "Notes");
			expect(result).toBe("Release created successfully");
		});

		it("should throw GitHubError on failure", async () => {
			// Mock checkGitHubCLI success
			mockExec.mockResolvedValueOnce({ stdout: "gh version 2.0.0", stderr: "" });
			mockExec.mockResolvedValueOnce({ stdout: "Logged in", stderr: "" });
			
			// Mock release creation failure
			mockExec.mockRejectedValueOnce(new Error("Release creation failed"));

			await expect(createRelease("v1.0.0", "Release", "Notes")).rejects.toThrow(GitHubError);
			await expect(createRelease("v1.0.0", "Release", "Notes")).rejects.toThrow("Failed to create release");
		});
	});
});