import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Get the current git branch name
 */
export async function getCurrentBranch(): Promise<string> {
	const { stdout } = await execAsync("git branch --show-current");
	return stdout.trim();
}

/**
 * Create and checkout a new branch
 */
export async function createBranch(branchName: string): Promise<void> {
	await execAsync(`git checkout -b "${branchName}"`);
}

/**
 * Pull latest changes from remote
 */
export async function pullLatest(): Promise<void> {
	await execAsync("git pull");
}

/**
 * Get list of changed files compared to a base branch
 */
export async function getChangedFiles(baseBranch = "main"): Promise<string[]> {
	try {
		// Try to get merge base first (for comparing feature branches)
		const { stdout: mergeBase } = await execAsync(`git merge-base ${baseBranch} HEAD`);
		const { stdout } = await execAsync(`git diff ${mergeBase.trim()} --name-only`);
		return stdout.trim() ? stdout.trim().split("\n") : [];
	} catch {
		// Fallback to simple diff if merge-base fails
		const { stdout } = await execAsync(`git diff ${baseBranch} --name-only`);
		return stdout.trim() ? stdout.trim().split("\n") : [];
	}
}

/**
 * Stage all changes and commit with a message
 */
export async function commitChanges(message: string): Promise<void> {
	await execAsync("git add .");
	await execAsync(`git commit -m "${message}"`);
}

/**
 * Push changes to remote
 */
export async function pushChanges(branch?: string): Promise<void> {
	if (branch) {
		await execAsync(`git push -u origin "${branch}"`);
	} else {
		await execAsync("git push");
	}
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
	const { stdout } = await execAsync("git status --porcelain");
	return stdout.trim().length > 0;
}

/**
 * Get git status
 */
export async function getGitStatus(): Promise<string> {
	const { stdout } = await execAsync("git status");
	return stdout;
}