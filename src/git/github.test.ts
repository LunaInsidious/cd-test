import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock exec completely to prevent any actual command execution
vi.mock("node:child_process", () => ({
	exec: vi.fn(),
}));

vi.mock("node:util", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: Required for mocking promisify function signature
	promisify: vi.fn((fn: any) => fn),
}));

// Import after mocking
import {
	GitHubError,
	checkExistingPR,
	createPullRequest,
	createRelease,
	getPRStatus,
	mergePullRequest,
	updatePullRequest,
} from "./github.js";

describe("git/github", () => {
	let mockExec: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		const { exec } = require("node:child_process");
		mockExec = vi.mocked(exec);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("GitHubError", () => {
		it("should create error with correct name and message", () => {
			const error = new GitHubError("Test error");
			expect(error.name).toBe("GitHubError");
			expect(error.message).toBe("Test error");
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe("checkExistingPR", () => {
		it("should return PR URL when PR exists", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "https://github.com/user/repo/pull/42\n" });
			});

			const result = await checkExistingPR();
			expect(result).toBe("https://github.com/user/repo/pull/42");
			expect(mockExec).toHaveBeenCalledWith(
				"gh pr view --json url --jq .url",
				expect.any(Function),
			);
		});

		it("should return null when no PR exists", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("no open pull request"), {
					stderr: "no open pull request",
				});
			});

			const result = await checkExistingPR();
			expect(result).toBeNull();
		});

		it("should throw GitHubError for other errors", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("authentication failed"), {
					stderr: "authentication failed",
				});
			});

			await expect(checkExistingPR()).rejects.toThrow(GitHubError);
			await expect(checkExistingPR()).rejects.toThrow("authentication failed");
		});
	});

	describe("createPullRequest", () => {
		it("should create PR and return URL", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				if (cmd.includes("gh pr create")) {
					callback(null, { stdout: "https://github.com/user/repo/pull/42\n" });
				}
			});

			const result = await createPullRequest("Test PR", "Test body");
			expect(result).toBe("https://github.com/user/repo/pull/42");
			expect(mockExec).toHaveBeenCalledWith(
				expect.stringContaining("gh pr create"),
				expect.any(Function),
			);
		});

		it("should handle special characters in title and body", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "https://github.com/user/repo/pull/42\n" });
			});

			await createPullRequest(
				'Title with "quotes"',
				"Body with $special chars",
			);
			expect(mockExec).toHaveBeenCalledWith(
				expect.stringContaining("gh pr create"),
				expect.any(Function),
			);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("failed to create"), { stderr: "failed to create" });
			});

			await expect(createPullRequest("Test", "Body")).rejects.toThrow(
				GitHubError,
			);
		});
	});

	describe("updatePullRequest", () => {
		it("should update PR successfully", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "Updated pull request\n" });
			});

			await updatePullRequest("Updated Title", "Updated body");
			expect(mockExec).toHaveBeenCalledWith(
				expect.stringContaining("gh pr edit"),
				expect.any(Function),
			);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("failed to update"), { stderr: "failed to update" });
			});

			await expect(updatePullRequest("Test", "Body")).rejects.toThrow(
				GitHubError,
			);
		});
	});

	describe("getPRStatus", () => {
		it("should return PR status with checks", async () => {
			const mockStatus = {
				state: "OPEN",
				mergeable: "MERGEABLE",
				statusCheckRollup: [
					{ name: "test", status: "SUCCESS" },
					{ name: "lint", status: "SUCCESS" },
				],
			};

			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: JSON.stringify(mockStatus) });
			});

			const result = await getPRStatus();
			expect(result).toEqual({
				state: "open",
				mergeable: true,
				checks: [
					{ name: "test", status: "SUCCESS" },
					{ name: "lint", status: "SUCCESS" },
				],
			});
		});

		it("should handle non-mergeable PR", async () => {
			const mockStatus = {
				state: "OPEN",
				mergeable: "CONFLICTING",
				statusCheckRollup: [],
			};

			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: JSON.stringify(mockStatus) });
			});

			const result = await getPRStatus();
			expect(result.mergeable).toBe(false);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("failed to get status"), {
					stderr: "failed to get status",
				});
			});

			await expect(getPRStatus()).rejects.toThrow(GitHubError);
		});
	});

	describe("mergePullRequest", () => {
		it("should merge PR with squash method", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "Merged successfully\n" });
			});

			await mergePullRequest("squash");
			expect(mockExec).toHaveBeenCalledWith(
				"gh pr merge --squash",
				expect.any(Function),
			);
		});

		it("should merge PR with merge method", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "Merged successfully\n" });
			});

			await mergePullRequest("merge");
			expect(mockExec).toHaveBeenCalledWith(
				"gh pr merge --merge",
				expect.any(Function),
			);
		});

		it("should merge PR with rebase method", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, { stdout: "Merged successfully\n" });
			});

			await mergePullRequest("rebase");
			expect(mockExec).toHaveBeenCalledWith(
				"gh pr merge --rebase",
				expect.any(Function),
			);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("failed to merge"), { stderr: "failed to merge" });
			});

			await expect(mergePullRequest("squash")).rejects.toThrow(GitHubError);
		});
	});

	describe("createRelease", () => {
		it("should create release and return URL", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				if (cmd.includes("gh release create")) {
					callback(null, {
						stdout: "https://github.com/user/repo/releases/tag/v1.0.0\n",
					});
				}
			});

			const result = await createRelease(
				"v1.0.0",
				"Release 1.0.0",
				"Release notes",
			);
			expect(result).toBe("https://github.com/user/repo/releases/tag/v1.0.0");
			expect(mockExec).toHaveBeenCalledWith(
				expect.stringContaining("gh release create"),
				expect.any(Function),
			);
		});

		it("should handle special characters in notes", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(null, {
					stdout: "https://github.com/user/repo/releases/tag/v1.0.0\n",
				});
			});

			await createRelease("v1.0.0", "Release", 'Notes with "quotes" and $vars');
			expect(mockExec).toHaveBeenCalledWith(
				expect.stringContaining("gh release create"),
				expect.any(Function),
			);
		});

		it("should throw GitHubError on failure", async () => {
			mockExec.mockImplementation((cmd, callback) => {
				callback(new Error("failed to create release"), {
					stderr: "failed to create release",
				});
			});

			await expect(createRelease("v1.0.0", "Release", "Notes")).rejects.toThrow(
				GitHubError,
			);
		});
	});
});