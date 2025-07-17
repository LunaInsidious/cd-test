import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class GitHubError extends Error {
	constructor(
		message: string,
		public exitCode?: number,
	) {
		super(message);
		this.name = "GitHubError";
	}
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
export async function checkGitHubCLI(): Promise<void> {
	try {
		await execAsync("gh --version");
	} catch {
		throw new GitHubError(
			"GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/",
		);
	}

	try {
		await execAsync("gh auth status");
	} catch {
		throw new GitHubError(
			"GitHub CLI is not authenticated. Please run 'gh auth login'",
		);
	}
}

/**
 * Create a GitHub pull request
 */
export async function createPullRequest(
	title: string,
	body: string,
	baseBranch = "main",
): Promise<string> {
	await checkGitHubCLI();

	try {
		const { stdout } = await execAsync(
			`gh pr create --title "${title}" --body "${body}" --base "${baseBranch}"`,
		);

		// Extract PR URL from output
		const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
		return urlMatch ? urlMatch[0] : stdout.trim();
	} catch (error) {
		if (error instanceof Error) {
			throw new GitHubError(`Failed to create PR: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Check if a PR exists for the current branch
 */
export async function checkExistingPR(): Promise<string | null> {
	await checkGitHubCLI();

	try {
		const { stdout } = await execAsync("gh pr view --json url");
		const prData = JSON.parse(stdout) as { url: string };
		return prData.url;
	} catch {
		// No PR exists for current branch
		return null;
	}
}

/**
 * Update an existing PR title and body
 */
export async function updatePullRequest(
	title: string,
	body: string,
): Promise<void> {
	await checkGitHubCLI();

	try {
		await execAsync(`gh pr edit --title "${title}" --body "${body}"`);
	} catch (error) {
		if (error instanceof Error) {
			throw new GitHubError(`Failed to update PR: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Merge a pull request
 */
export async function mergePullRequest(
	method: "merge" | "squash" | "rebase" = "squash",
): Promise<void> {
	await checkGitHubCLI();

	try {
		await execAsync(`gh pr merge --${method} --delete-branch`);
	} catch (error) {
		if (error instanceof Error) {
			throw new GitHubError(`Failed to merge PR: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Check PR status (mergeable, CI status, etc.)
 */
export async function getPRStatus(): Promise<{
	mergeable: boolean;
	state: string;
	checks: Array<{ name: string; status: string }>;
}> {
	await checkGitHubCLI();

	try {
		const { stdout } = await execAsync(
			"gh pr view --json mergeable,state,statusCheckRollupStates",
		);
		const data = JSON.parse(stdout) as {
			mergeable: string;
			state: string;
			statusCheckRollupStates: Array<{ context: string; state: string }>;
		};

		return {
			mergeable: data.mergeable === "MERGEABLE",
			state: data.state,
			checks: data.statusCheckRollupStates.map((check) => ({
				name: check.context,
				status: check.state,
			})),
		};
	} catch (error) {
		if (error instanceof Error) {
			throw new GitHubError(`Failed to get PR status: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Create a GitHub release
 */
export async function createRelease(
	tag: string,
	title: string,
	body: string,
	prerelease = false,
): Promise<string> {
	await checkGitHubCLI();

	try {
		const prereleaseFlag = prerelease ? "--prerelease" : "";
		const { stdout } = await execAsync(
			`gh release create "${tag}" --title "${title}" --notes "${body}" ${prereleaseFlag}`,
		);

		// Extract release URL from output
		const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
		return urlMatch ? urlMatch[0] : stdout.trim();
	} catch (error) {
		if (error instanceof Error) {
			throw new GitHubError(`Failed to create release: ${error.message}`);
		}
		throw error;
	}
}
