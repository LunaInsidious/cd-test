import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
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

// Mock the exec function
vi.mock("node:child_process", () => ({
	exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

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
			// Mock gh --version success
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "gh version 2.0.0", stderr: "" });
			}) as any);

			// Mock gh auth status success
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "Logged in to github.com", stderr: "" });
			}) as any);

			await expect(checkGitHubCLI()).resolves.toBeUndefined();
		});

		it("should throw GitHubError when gh is not installed", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Command not found"), null);
			}) as any);

			await expect(checkGitHubCLI()).rejects.toThrow(GitHubError);
			await expect(checkGitHubCLI()).rejects.toThrow("GitHub CLI (gh) is not installed");
		});

		it("should throw GitHubError when gh is not authenticated", async () => {
			// Mock gh --version success
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "gh version 2.0.0", stderr: "" });
			}) as any);

			// Mock gh auth status failure
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Not authenticated"), null);
			}) as any);

			await expect(checkGitHubCLI()).rejects.toThrow(GitHubError);
			await expect(checkGitHubCLI()).rejects.toThrow("GitHub CLI is not authenticated");
		});
	});

	describe("createPullRequest", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success for all PR tests
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should create PR and return URL", async () => {
			const mockOutput = "https://github.com/user/repo/pull/123\n";
			
			// Mock the actual PR creation
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('gh pr create');
				expect(command).toContain('--title "Release v1.0.0"');
				expect(command).toContain('--body "Test PR body"');
				expect(command).toContain('--base "main"');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await createPullRequest("Release v1.0.0", "Test PR body");
			expect(result).toBe("https://github.com/user/repo/pull/123");
		});

		it("should handle custom base branch", async () => {
			const mockOutput = "https://github.com/user/repo/pull/124\n";
			
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('--base "develop"');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			await createPullRequest("Test PR", "Test body", "develop");
		});

		it("should return stdout if no URL found", async () => {
			const mockOutput = "PR created successfully but no URL found\n";
			
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await createPullRequest("Test PR", "Test body");
			expect(result).toBe("PR created successfully but no URL found");
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("PR creation failed"), null);
			}) as any);

			await expect(createPullRequest("Test PR", "Test body")).rejects.toThrow(GitHubError);
			await expect(createPullRequest("Test PR", "Test body")).rejects.toThrow("Failed to create PR");
		});
	});

	describe("checkExistingPR", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should return PR URL if exists", async () => {
			const mockOutput = '{"url": "https://github.com/user/repo/pull/123"}';
			
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('gh pr view --json url');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await checkExistingPR();
			expect(result).toBe("https://github.com/user/repo/pull/123");
		});

		it("should return null if no PR exists", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("No pull request found"), null);
			}) as any);

			const result = await checkExistingPR();
			expect(result).toBeNull();
		});
	});

	describe("updatePullRequest", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should update PR title and body", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('gh pr edit');
				expect(command).toContain('--title "Updated Title"');
				expect(command).toContain('--body "Updated Body"');
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await expect(updatePullRequest("Updated Title", "Updated Body")).resolves.toBeUndefined();
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Update failed"), null);
			}) as any);

			await expect(updatePullRequest("Title", "Body")).rejects.toThrow(GitHubError);
			await expect(updatePullRequest("Title", "Body")).rejects.toThrow("Failed to update PR");
		});
	});

	describe("mergePullRequest", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should merge PR with squash method by default", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toBe('gh pr merge --squash --delete-branch');
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await expect(mergePullRequest()).resolves.toBeUndefined();
		});

		it("should merge PR with specified method", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toBe('gh pr merge --rebase --delete-branch');
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await expect(mergePullRequest("rebase")).resolves.toBeUndefined();
		});

		it("should throw GitHubError on merge failure", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Merge failed"), null);
			}) as any);

			await expect(mergePullRequest()).rejects.toThrow(GitHubError);
			await expect(mergePullRequest()).rejects.toThrow("Failed to merge PR");
		});
	});

	describe("getPRStatus", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should return PR status information", async () => {
			const mockOutput = JSON.stringify({
				mergeable: "MERGEABLE",
				state: "OPEN",
				statusCheckRollupStates: [
					{ context: "ci/build", state: "SUCCESS" },
					{ context: "ci/test", state: "PENDING" },
				],
			});

			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('gh pr view --json mergeable,state,statusCheckRollupStates');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

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

			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await getPRStatus();
			expect(result.mergeable).toBe(false);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Status check failed"), null);
			}) as any);

			await expect(getPRStatus()).rejects.toThrow(GitHubError);
			await expect(getPRStatus()).rejects.toThrow("Failed to get PR status");
		});
	});

	describe("createRelease", () => {
		beforeEach(() => {
			// Mock checkGitHubCLI success
			mockExec.mockImplementation(((command: string, callback: any) => {
				if (command.includes("--version") || command.includes("auth status")) {
					callback(null, { stdout: "success", stderr: "" });
				}
			}) as any);
		});

		it("should create release and return URL", async () => {
			const mockOutput = "https://github.com/user/repo/releases/tag/v1.0.0\n";

			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('gh release create "v1.0.0"');
				expect(command).toContain('--title "Release v1.0.0"');
				expect(command).toContain('--notes "Release notes"');
				expect(command).not.toContain('--prerelease');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await createRelease("v1.0.0", "Release v1.0.0", "Release notes");
			expect(result).toBe("https://github.com/user/repo/releases/tag/v1.0.0");
		});

		it("should create prerelease when specified", async () => {
			const mockOutput = "https://github.com/user/repo/releases/tag/v1.0.0-rc.1\n";

			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain('--prerelease');
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await createRelease("v1.0.0-rc.1", "RC Release", "RC notes", true);
			expect(result).toBe("https://github.com/user/repo/releases/tag/v1.0.0-rc.1");
		});

		it("should return stdout if no URL found", async () => {
			const mockOutput = "Release created successfully\n";

			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: mockOutput, stderr: "" });
			}) as any);

			const result = await createRelease("v1.0.0", "Release", "Notes");
			expect(result).toBe("Release created successfully");
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Release creation failed"), null);
			}) as any);

			await expect(createRelease("v1.0.0", "Release", "Notes")).rejects.toThrow(GitHubError);
			await expect(createRelease("v1.0.0", "Release", "Notes")).rejects.toThrow("Failed to create release");
		});
	});
});