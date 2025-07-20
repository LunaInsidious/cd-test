import { spawn } from "node:child_process";
import prompts from "prompts";
import { getAvailableBranches } from "./git.js";

/**
 * GitHub CLI utility functions
 */

export class GitHubError extends Error {
	constructor(
		message: string,
		public readonly command: string,
	) {
		super(message);
		this.name = "GitHubError";
	}
}

/**
 * Execute gh command using spawn for security
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
 * Check if PR exists for current branch
 */
export async function checkPrExists(): Promise<boolean> {
	try {
		const result = await execGh([
			"pr",
			"status",
			"--jq",
			".currentBranch.url",
			"--json",
			"url",
		]);
		const status = JSON.parse(result);
		return status.currentBranch !== null;
	} catch (_) {
		// If command fails, assume no PR exists
		return false;
	}
}

/**
 * Create a pull request
 * @param title - The PR title
 * @param body - The PR body
 * @param baseBranch - The base branch for the PR
 */
async function createPullRequest(
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
 * Create a pull request with interactive base branch selection
 * @param title - The PR title
 * @param body - The PR body
 * @param defaultBaseBranch - The default base branch to suggest
 */
export async function createPullRequestInteractive(
	title: string,
	body: string,
	defaultBaseBranch: string,
): Promise<string> {
	try {
		// Get available branches
		const availableBranches = await getAvailableBranches();

		// Filter out current branch and add "Create new branch" option
		const currentBranch = process.env["GITHUB_HEAD_REF"] || "HEAD";
		const branchChoices = availableBranches
			.filter((branch) => branch !== currentBranch)
			.map((branch) => ({ title: branch, value: branch }));

		// Add default as first option if not already in list
		if (!branchChoices.some((choice) => choice.value === defaultBaseBranch)) {
			branchChoices.unshift({
				title: `${defaultBaseBranch} (default)`,
				value: defaultBaseBranch,
			});
		}

		// Add new branch creation option
		branchChoices.push({ title: "Create new branch...", value: "__new__" });

		const response = await prompts({
			type: "select",
			name: "baseBranch",
			message: "Select base branch for the pull request:",
			choices: branchChoices,
			initial: 0, // Default to first option (default branch)
		});

		if (!response.baseBranch) {
			throw new Error("No base branch selected");
		}

		let baseBranch = response.baseBranch;

		// Handle new branch creation
		if (baseBranch === "__new__") {
			const newBranchResponse = await prompts({
				type: "text",
				name: "newBranch",
				message: "Enter new branch name:",
				validate: (value: string) =>
					value.trim().length > 0 || "Branch name cannot be empty",
			});

			if (!newBranchResponse.newBranch) {
				throw new Error("No branch name provided");
			}

			baseBranch = newBranchResponse.newBranch.trim();
		}

		// Create the PR with selected base branch
		return await createPullRequest(title, body, baseBranch);
	} catch (error) {
		throw new GitHubError(
			`Failed to create pull request interactively: ${error instanceof Error ? error.message : String(error)}`,
			`gh pr create --title "${title}" --body "${body}"`,
		);
	}
}

/**
 * Get PR URL for current branch
 */
export async function getCurrentPrUrl(): Promise<string | null> {
	try {
		const result = await execGh(["pr", "status", "--json", "currentBranch"]);
		const status = JSON.parse(result);
		return status.currentBranch?.url || null;
	} catch (_error) {
		return null;
	}
}
