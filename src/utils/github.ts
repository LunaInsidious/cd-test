import { spawn } from "node:child_process";

/**
 * GitHub CLI utility functions
 */

class GitHubError extends Error {
	constructor(
		message: string,
		public readonly command: string,
	) {
		super(message);
		this.name = "GitHubError";
	}
}

/**
 * Execute a gh command and return the output
 * @param args - Array of command line arguments for gh
 * @returns Output of the command
 * @throws GitHubError if the command fails
 * @throws Error if the command execution fails
 */
async function execGh(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const gh = spawn("gh", args);
		let stdout = "";
		let stderr = "";

		gh.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		gh.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		gh.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(stderr || `gh command failed with code ${code}`));
			}
		});

		gh.on("error", (error) => {
			reject(error);
		});
	});
}

/**
 * Create a pull request
 * @param title - The PR title
 * @param body - The PR body
 * @param baseBranch - The base branch for the PR
 */
export async function createPullRequest(
	title: string,
	body: string,
	baseBranch: string,
): Promise<string> {
	try {
		const result = await execGh([
			"pr",
			"create",
			"--title",
			title,
			"--body",
			body,
			"--base",
			baseBranch,
		]);
		return result; // Returns PR URL
	} catch (error) {
		throw new GitHubError(
			`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}\nRun \`gh auth status\` to check if you are logged in to your account.`,
			`gh pr create --title "${title}" --body "${body}" --base ${baseBranch}`,
		);
	}
}

/**
 * Get the current pull request URL
 * If no PR exists, returns null
 * @returns Pull request URL or null if no PR exists
 * If an error occurs, it throws a GitHubError
 */
export async function getCurrentPrUrl(): Promise<string | null> {
	const result = await execGh([
		"pr",
		"status",
		"--jq",
		".currentBranch.url",
		"--json",
		"url",
	]);
	if (result !== "") {
		return result; // Returns PR URL if exists
	}
	return null; // No PR exists for current branch
}

/**
 * Merge a pull request with squash
 * @param prUrl - The pull request URL to merge
 */
export async function mergePullRequest(prUrl: string): Promise<void> {
	try {
		await execGh([
			"pr",
			"merge",
			"--auto",
			"--delete-branch",
			"--squash",
			prUrl,
		]);
	} catch (error) {
		throw new GitHubError(
			`Failed to merge pull request: ${error instanceof Error ? error.message : String(error)}\nPlease ensure that "Allow auto merge" and "Allow squash merging" are enabled in your GitHub settings.`,
			`gh pr merge --auto --delete-branch --squash ${prUrl}`,
		);
	}
}
