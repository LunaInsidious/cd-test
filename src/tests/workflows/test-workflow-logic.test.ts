import { exec } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it } from "vitest";

const execAsync = promisify(exec);

/**
 * Tests for the workflow logic without full act execution
 * This tests the shell script logic used in the workflow
 */
describe("Workflow Logic Tests", () => {
	const testDir = "/tmp/cd-tools-workflow-logic-test";
	const cdtoolsDir = join(testDir, ".cdtools");

	beforeEach(async () => {
		// Clean up and create test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
		await mkdir(testDir, { recursive: true });
		await mkdir(cdtoolsDir, { recursive: true });

		// Create mock config.json
		const config = {
			projects: [
				{
					path: "packages/frontend",
					baseVersion: "1.0.0",
					registries: ["npm"],
				},
				{
					path: "packages/backend",
					baseVersion: "2.0.0",
					registries: ["docker"],
				},
				{
					path: "packages/fullstack",
					baseVersion: "1.5.0",
					registries: ["npm", "docker"],
				},
			],
			versioningStrategy: "independent",
			versionTags: {
				alpha: {
					versionSuffixStrategy: "timestamp",
					next: "rc",
				},
				rc: {
					versionSuffixStrategy: "increment",
					next: "stable",
				},
				stable: {
					versionSuffixStrategy: "none",
				},
			},
		};

		await writeFile(
			join(cdtoolsDir, "config.json"),
			JSON.stringify(config, null, 2),
		);

		// Change to test directory
		process.chdir(testDir);

		// Initialize git repo
		await execAsync("git init");
		await execAsync("git config user.email 'test@example.com'");
		await execAsync("git config user.name 'Test User'");
		await execAsync("git add .");
		await execAsync("git commit -m 'Initial commit'");
	});

	describe("Branch info file detection", () => {
		it("should detect branch info file from current branch", async () => {
			// Create branch and branch info file
			await execAsync("git checkout -b feat/test\\(alpha\\)");

			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/frontend": "1.0.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-test.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			// Test the branch detection logic
			const script = `
				CURRENT_BRANCH=$(git branch --show-current)
				BRANCH_INFO_FILE=".cdtools/$(echo $CURRENT_BRANCH | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g').json"
				echo $BRANCH_INFO_FILE
			`;

			const { stdout } = await execAsync(script);
			expect(stdout.trim()).toBe(".cdtools/feat-test-alpha-.json");
		});

		it("should fallback to workspaceUpdated search when branch file not found", async () => {
			await execAsync("git checkout -b feat/unknown\\(alpha\\)");

			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/frontend": "1.0.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-test.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			// Test the fallback logic
			const script = `
				CURRENT_BRANCH=$(git branch --show-current)
				BRANCH_INFO_FILE=".cdtools/$(echo $CURRENT_BRANCH | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g').json"

				if [ ! -f "$BRANCH_INFO_FILE" ]; then
					BRANCH_INFO_FILE=$(find .cdtools -name "*-*.json" -exec grep -l "workspaceUpdated" {} \\; | head -1)
				fi

				echo $BRANCH_INFO_FILE
			`;

			const { stdout } = await execAsync(script);
			expect(stdout.trim()).toBe(".cdtools/alpha-feat-test.json");
		});
	});

	describe("Workspace analysis", () => {
		it("should analyze npm-only workspace", async () => {
			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/frontend": "1.0.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-npm.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			// Test the workspace analysis logic using Node.js
			const script = `
				node -e "
					const branchInfo = JSON.parse(require('fs').readFileSync('.cdtools/alpha-feat-npm.json', 'utf-8'));
					const config = JSON.parse(require('fs').readFileSync('.cdtools/config.json', 'utf-8'));

					if (!branchInfo.workspaceUpdated) {
						console.log('{}');
						process.exit(0);
					}

					const npmWorkspaces = [];
					const dockerWorkspaces = [];

					for (const [workspacePath, version] of Object.entries(branchInfo.workspaceUpdated)) {
						const project = config.projects.find(p => p.path === workspacePath);
						if (!project) continue;

						const workspaceInfo = { workspace_path: workspacePath, workspace_version: version };

						if (project.registries.includes('npm')) {
							npmWorkspaces.push(workspaceInfo);
						}

						if (project.registries.includes('docker')) {
							dockerWorkspaces.push(workspaceInfo);
						}
					}

					console.log(JSON.stringify({
						npm: npmWorkspaces,
						docker: dockerWorkspaces,
						has_npm: npmWorkspaces.length > 0,
						has_docker: dockerWorkspaces.length > 0
					}));
				"
			`;

			const { stdout } = await execAsync(script);
			const result = JSON.parse(stdout.trim());

			expect(result.has_npm).toBe(true);
			expect(result.has_docker).toBe(false);
			expect(result.npm).toHaveLength(1);
			expect(result.npm[0].workspace_path).toBe("packages/frontend");
			expect(result.npm[0].workspace_version).toBe(
				"1.0.1-alpha.20231225103045",
			);
		});

		it("should analyze docker-only workspace", async () => {
			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/backend": "2.0.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-docker.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			const script = `
				node -e "
					const branchInfo = JSON.parse(require('fs').readFileSync('.cdtools/alpha-feat-docker.json', 'utf-8'));
					const config = JSON.parse(require('fs').readFileSync('.cdtools/config.json', 'utf-8'));

					const npmWorkspaces = [];
					const dockerWorkspaces = [];

					for (const [workspacePath, version] of Object.entries(branchInfo.workspaceUpdated)) {
						const project = config.projects.find(p => p.path === workspacePath);
						if (!project) continue;

						const workspaceInfo = { workspace_path: workspacePath, workspace_version: version };

						if (project.registries.includes('npm')) {
							npmWorkspaces.push(workspaceInfo);
						}

						if (project.registries.includes('docker')) {
							dockerWorkspaces.push(workspaceInfo);
						}
					}

					console.log(JSON.stringify({
						npm: npmWorkspaces,
						docker: dockerWorkspaces,
						has_npm: npmWorkspaces.length > 0,
						has_docker: dockerWorkspaces.length > 0
					}));
				"
			`;

			const { stdout } = await execAsync(script);
			const result = JSON.parse(stdout.trim());

			expect(result.has_npm).toBe(false);
			expect(result.has_docker).toBe(true);
			expect(result.docker).toHaveLength(1);
			expect(result.docker[0].workspace_path).toBe("packages/backend");
		});

		it("should analyze mixed npm and docker workspace", async () => {
			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/fullstack": "1.5.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-mixed.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			const script = `
				node -e "
					const branchInfo = JSON.parse(require('fs').readFileSync('.cdtools/alpha-feat-mixed.json', 'utf-8'));
					const config = JSON.parse(require('fs').readFileSync('.cdtools/config.json', 'utf-8'));

					const npmWorkspaces = [];
					const dockerWorkspaces = [];

					for (const [workspacePath, version] of Object.entries(branchInfo.workspaceUpdated)) {
						const project = config.projects.find(p => p.path === workspacePath);
						if (!project) continue;

						const workspaceInfo = { workspace_path: workspacePath, workspace_version: version };

						if (project.registries.includes('npm')) {
							npmWorkspaces.push(workspaceInfo);
						}

						if (project.registries.includes('docker')) {
							dockerWorkspaces.push(workspaceInfo);
						}
					}

					console.log(JSON.stringify({
						npm: npmWorkspaces,
						docker: dockerWorkspaces,
						has_npm: npmWorkspaces.length > 0,
						has_docker: dockerWorkspaces.length > 0
					}));
				"
			`;

			const { stdout } = await execAsync(script);
			const result = JSON.parse(stdout.trim());

			expect(result.has_npm).toBe(true);
			expect(result.has_docker).toBe(true);
			expect(result.npm).toHaveLength(1);
			expect(result.docker).toHaveLength(1);
			expect(result.npm[0].workspace_path).toBe("packages/fullstack");
			expect(result.docker[0].workspace_path).toBe("packages/fullstack");
		});

		it("should handle empty workspaceUpdated", async () => {
			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-empty.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			const script = `
				node -e "
					const branchInfo = JSON.parse(require('fs').readFileSync('.cdtools/alpha-feat-empty.json', 'utf-8'));
					const config = JSON.parse(require('fs').readFileSync('.cdtools/config.json', 'utf-8'));

					if (!branchInfo.workspaceUpdated) {
						console.log(JSON.stringify({
							npm: [],
							docker: [],
							has_npm: false,
							has_docker: false
						}));
						process.exit(0);
					}
				"
			`;

			const { stdout } = await execAsync(script);
			const result = JSON.parse(stdout.trim());

			expect(result.has_npm).toBe(false);
			expect(result.has_docker).toBe(false);
			expect(result.npm).toHaveLength(0);
			expect(result.docker).toHaveLength(0);
		});
	});

	describe("Matrix generation", () => {
		it("should generate proper matrix format", async () => {
			const branchInfo = {
				tag: "alpha",
				parentBranch: "main",
				workspaceUpdated: {
					"packages/frontend": "1.0.1-alpha.20231225103045",
					"packages/backend": "2.0.1-alpha.20231225103045",
				},
			};

			await writeFile(
				join(cdtoolsDir, "alpha-feat-matrix.json"),
				JSON.stringify(branchInfo, null, 2),
			);

			const script = `
				WORKSPACE_UPDATED=$(node -e "
					const branchInfo = JSON.parse(require('fs').readFileSync('.cdtools/alpha-feat-matrix.json', 'utf-8'));
					const config = JSON.parse(require('fs').readFileSync('.cdtools/config.json', 'utf-8'));

					const npmWorkspaces = [];
					const dockerWorkspaces = [];

					for (const [workspacePath, version] of Object.entries(branchInfo.workspaceUpdated)) {
						const project = config.projects.find(p => p.path === workspacePath);
						if (!project) continue;

						const workspaceInfo = { workspace_path: workspacePath, workspace_version: version };

						if (project.registries.includes('npm')) {
							npmWorkspaces.push(workspaceInfo);
						}

						if (project.registries.includes('docker')) {
							dockerWorkspaces.push(workspaceInfo);
						}
					}

					console.log(JSON.stringify({
						npm: npmWorkspaces,
						docker: dockerWorkspaces
					}));
				")

				NPM_MATRIX=$(echo "$WORKSPACE_UPDATED" | node -e "
					const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf-8'));
					console.log(JSON.stringify({ include: data.npm }));
				")

				echo $NPM_MATRIX
			`;

			const { stdout } = await execAsync(script);
			const matrix = JSON.parse(stdout.trim());

			expect(matrix.include).toHaveLength(1);
			expect(matrix.include[0].workspace_path).toBe("packages/frontend");
			expect(matrix.include[0].workspace_version).toBe(
				"1.0.1-alpha.20231225103045",
			);
		});
	});
});
