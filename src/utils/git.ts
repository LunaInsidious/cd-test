import { spawn } from "node:child_process";

/**
 * Git utility functions for branch operations
 */
export class GitError extends Error {
	constructor(
		message: string,
		public readonly command: string,
	) {
		super(message);
		this.name = "GitError";
	}
}

/**
 * Execute git command using spawn for security
 */
async function execGit(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const git = spawn("git", args);
		let stdout = "";
		let stderr = "";

		git.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		git.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		git.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(stderr || `Git command failed with code ${code}`));
			}
		});

		git.on("error", (error) => {
			reject(error);
		});
	});
}

/**
 * Validate branch name using git check-ref-format
 */
export async function validateBranchName(branchName: string): Promise<void> {
	try {
		await execGit(["check-ref-format", "--branch", branchName]);
	} catch (error) {
		throw new Error(
			`Invalid branch name: ${branchName}. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Pull latest changes from remote for a specific branch
 * @param branchName - The branch name to pull (validates with git check-ref-format)
 */
export async function pullLatest(branchName: string): Promise<void> {
	await validateBranchName(branchName);

	try {
		await execGit(["pull", "origin", branchName]);
	} catch (error) {
		throw new GitError(
			`Failed to pull latest changes for branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
			`git pull origin ${branchName}`,
		);
	}
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
	try {
		return await execGit(["branch", "--show-current"]);
	} catch (error) {
		throw new GitError(
			`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
			"git branch --show-current",
		);
	}
}

/**
 * Create and checkout a new branch
 * @param branchName - The branch name to create (validates with git check-ref-format)
 */
export async function createAndCheckoutBranch(
	branchName: string,
): Promise<void> {
	await validateBranchName(branchName);

	try {
		await execGit(["checkout", "-b", branchName]);
	} catch (error) {
		throw new GitError(
			`Failed to create branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
			`git checkout -b ${branchName}`,
		);
	}
}
