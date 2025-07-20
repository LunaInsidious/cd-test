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

/**
 * Get list of changed files since the last release
 * First tries `git diff HEAD..@{u} --name-only`, then falls back to merge-base if no upstream
 * @param parentBranch - The parent branch to compare against (validates with git check-ref-format)
 */
export async function getChangedFiles(parentBranch: string): Promise<string[]> {
	await validateBranchName(parentBranch);

	try {
		// First try: compare with upstream
		const output = await execGit(["diff", "HEAD..@{u}", "--name-only"]);
		return output ? output.split("\n").filter(Boolean) : [];
	} catch (upstreamError) {
		// Check if error is about no upstream configured
		const errorMessage =
			upstreamError instanceof Error
				? upstreamError.message
				: String(upstreamError);
		if (errorMessage.includes("no upstream configured for branch")) {
			try {
				// Fallback: use merge-base with parent branch
				const mergeBase = await execGit(["merge-base", parentBranch, "HEAD"]);
				const output = await execGit([
					"diff",
					mergeBase,
					"HEAD",
					"--name-only",
				]);
				return output ? output.split("\n").filter(Boolean) : [];
			} catch (fallbackError) {
				throw new GitError(
					`Failed to get changed files using merge-base with '${parentBranch}': ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
					`git diff $(git merge-base ${parentBranch} HEAD) HEAD --name-only`,
				);
			}
		} else {
			throw new GitError(
				`Failed to get changed files from upstream: ${errorMessage}`,
				"git diff HEAD..@{u} --name-only",
			);
		}
	}
}

/**
 * Commit changes with a specific message
 * @param message - The commit message
 */
export async function commitChanges(message: string): Promise<void> {
	try {
		// Add all changes
		await execGit(["add", "-A"]);

		// Commit with message
		await execGit(["commit", "-m", message]);
	} catch (error) {
		throw new GitError(
			`Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`,
			`git commit -m "${message}"`,
		);
	}
}

/**
 * Push changes to remote
 * @param branchName - The branch to push (validates with git check-ref-format)
 */
export async function pushChanges(branchName: string): Promise<void> {
	await validateBranchName(branchName);

	try {
		await execGit(["push", "origin", branchName]);
	} catch (error) {
		throw new GitError(
			`Failed to push changes to '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
			`git push origin ${branchName}`,
		);
	}
}

/**
 * Get list of available branches (local and remote)
 */
export async function getAvailableBranches(): Promise<string[]> {
	try {
		const output = await execGit(["branch", "-a", "--format=%(refname:short)"]);
		return output
			.split("\n")
			.filter(Boolean)
			.map((branch) => branch.replace(/^origin\//, ""))
			.filter((branch, index, arr) => arr.indexOf(branch) === index) // Remove duplicates
			.sort();
	} catch (error) {
		throw new GitError(
			`Failed to get available branches: ${error instanceof Error ? error.message : String(error)}`,
			"git branch -a --format=%(refname:short)",
		);
	}
}

/**
 * Get all tags matching a pattern
 * @param pattern - The pattern to match tags against (e.g., "v1.0.0-alpha.*")
 */
export async function getTagsMatchingPattern(
	pattern: string,
): Promise<string[]> {
	try {
		// fetch remote tags first
		await execGit(["fetch", "--tags"]);
		const output = await execGit(["tag", "-l", pattern]);
		return output ? output.split("\n").filter(Boolean) : [];
	} catch (error) {
		throw new GitError(
			`Failed to get tags matching pattern '${pattern}': ${error instanceof Error ? error.message : String(error)}`,
			`git tag -l ${pattern}`,
		);
	}
}

/**
 * Switch to a different branch
 * @param branchName - The branch name to switch to (validates with git check-ref-format)
 */
export async function switchToBranch(branchName: string): Promise<void> {
	await validateBranchName(branchName);

	try {
		await execGit(["checkout", branchName]);
	} catch (error) {
		throw new GitError(
			`Failed to switch to branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
			`git checkout ${branchName}`,
		);
	}
}

/**
 * Delete a local branch
 * @param branchName - The branch name to delete (validates with git check-ref-format)
 * @param force - Whether to force delete the branch (default: false)
 */
export async function deleteLocalBranch(
	branchName: string,
	force = false,
): Promise<void> {
	await validateBranchName(branchName);

	try {
		const args = force
			? ["branch", "-D", branchName]
			: ["branch", "-d", branchName];
		await execGit(args);
	} catch (error) {
		throw new GitError(
			`Failed to delete local branch '${branchName}': ${error instanceof Error ? error.message : String(error)}`,
			`git branch ${force ? "-D" : "-d"} ${branchName}`,
		);
	}
}
