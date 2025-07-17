import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
	getCurrentBranch,
	createBranch,
	pullLatest,
	getChangedFiles,
	commitChanges,
	pushChanges,
	hasUncommittedChanges,
	getGitStatus,
} from "./operations.js";

// Mock the exec function
vi.mock("node:child_process", () => ({
	exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);
const execAsync = promisify(exec);

describe("git/operations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("getCurrentBranch", () => {
		it("should return current branch name", async () => {
			const mockStdout = "feature/test-branch\n";
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: mockStdout, stderr: "" });
			}) as any);

			const result = await getCurrentBranch();
			expect(result).toBe("feature/test-branch");
			expect(mockExec).toHaveBeenCalledWith("git branch --show-current", expect.any(Function));
		});

		it("should handle empty branch name", async () => {
			const mockStdout = "\n";
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: mockStdout, stderr: "" });
			}) as any);

			const result = await getCurrentBranch();
			expect(result).toBe("");
		});

		it("should throw error on git command failure", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(new Error("Not a git repository"), null);
			}) as any);

			await expect(getCurrentBranch()).rejects.toThrow("Not a git repository");
		});
	});

	describe("createBranch", () => {
		it("should create and checkout new branch", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await createBranch("feature/new-feature");

			expect(mockExec).toHaveBeenCalledWith(
				'git checkout -b "feature/new-feature"',
				expect.any(Function)
			);
		});

		it("should handle branch names with special characters", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await createBranch("rc:feature/test-branch");

			expect(mockExec).toHaveBeenCalledWith(
				'git checkout -b "rc:feature/test-branch"',
				expect.any(Function)
			);
		});

		it("should throw error if branch creation fails", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(new Error("Branch already exists"), null);
			}) as any);

			await expect(createBranch("existing-branch")).rejects.toThrow("Branch already exists");
		});
	});

	describe("pullLatest", () => {
		it("should pull latest changes", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "Already up to date.", stderr: "" });
			}) as any);

			await pullLatest();

			expect(mockExec).toHaveBeenCalledWith("git pull", expect.any(Function));
		});

		it("should throw error on pull failure", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(new Error("Network error"), null);
			}) as any);

			await expect(pullLatest()).rejects.toThrow("Network error");
		});
	});

	describe("getChangedFiles", () => {
		it("should return changed files compared to main", async () => {
			const mockFiles = "src/file1.ts\nsrc/file2.ts\nREADME.md\n";
			
			// Mock merge-base command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "abc123\n", stderr: "" });
			}) as any);
			
			// Mock diff command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: mockFiles, stderr: "" });
			}) as any);

			const result = await getChangedFiles("main");
			expect(result).toEqual(["src/file1.ts", "src/file2.ts", "README.md"]);
		});

		it("should return empty array when no changes", async () => {
			// Mock merge-base command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "abc123\n", stderr: "" });
			}) as any);
			
			// Mock diff command with empty output
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			const result = await getChangedFiles("main");
			expect(result).toEqual([]);
		});

		it("should fallback to simple diff if merge-base fails", async () => {
			const mockFiles = "src/fallback.ts\n";
			
			// Mock merge-base command failure
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("No merge base"), null);
			}) as any);
			
			// Mock fallback diff command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: mockFiles, stderr: "" });
			}) as any);

			const result = await getChangedFiles("main");
			expect(result).toEqual(["src/fallback.ts"]);
		});

		it("should use custom base branch", async () => {
			// Mock merge-base command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				expect(command).toContain("develop");
				callback(null, { stdout: "abc123\n", stderr: "" });
			}) as any);
			
			// Mock diff command
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "file.ts\n", stderr: "" });
			}) as any);

			await getChangedFiles("develop");
		});
	});

	describe("commitChanges", () => {
		it("should stage and commit changes", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await commitChanges("feat: add new feature");

			expect(mockExec).toHaveBeenCalledWith("git add .", expect.any(Function));
			expect(mockExec).toHaveBeenCalledWith(
				'git commit -m "feat: add new feature"',
				expect.any(Function)
			);
		});

		it("should handle commit messages with quotes", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await commitChanges('feat: add "quoted" feature');

			expect(mockExec).toHaveBeenCalledWith(
				'git commit -m "feat: add "quoted" feature"',
				expect.any(Function)
			);
		});

		it("should throw error if commit fails", async () => {
			// Mock git add success
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);
			
			// Mock git commit failure
			mockExec.mockImplementationOnce(((command: string, callback: any) => {
				callback(new Error("Nothing to commit"), null);
			}) as any);

			await expect(commitChanges("test commit")).rejects.toThrow("Nothing to commit");
		});
	});

	describe("pushChanges", () => {
		it("should push to current branch", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await pushChanges();

			expect(mockExec).toHaveBeenCalledWith("git push", expect.any(Function));
		});

		it("should push to specified branch with upstream", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			await pushChanges("feature/new-branch");

			expect(mockExec).toHaveBeenCalledWith(
				'git push -u origin "feature/new-branch"',
				expect.any(Function)
			);
		});

		it("should throw error on push failure", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(new Error("Permission denied"), null);
			}) as any);

			await expect(pushChanges()).rejects.toThrow("Permission denied");
		});
	});

	describe("hasUncommittedChanges", () => {
		it("should return true when there are uncommitted changes", async () => {
			const mockStatus = "M  src/file.ts\n?? new-file.ts\n";
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: mockStatus, stderr: "" });
			}) as any);

			const result = await hasUncommittedChanges();
			expect(result).toBe(true);
		});

		it("should return false when working tree is clean", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "", stderr: "" });
			}) as any);

			const result = await hasUncommittedChanges();
			expect(result).toBe(false);
		});

		it("should return false for whitespace-only output", async () => {
			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: "   \n  \n", stderr: "" });
			}) as any);

			const result = await hasUncommittedChanges();
			expect(result).toBe(false);
		});
	});

	describe("getGitStatus", () => {
		it("should return git status output", async () => {
			const mockStatus = `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   src/file.ts

Untracked files:
  new-file.ts`;

			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: mockStatus, stderr: "" });
			}) as any);

			const result = await getGitStatus();
			expect(result).toBe(mockStatus);
			expect(mockExec).toHaveBeenCalledWith("git status", expect.any(Function));
		});

		it("should handle clean status", async () => {
			const mockStatus = `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`;

			mockExec.mockImplementation(((command: string, callback: any) => {
				callback(null, { stdout: mockStatus, stderr: "" });
			}) as any);

			const result = await getGitStatus();
			expect(result).toBe(mockStatus);
		});
	});
});