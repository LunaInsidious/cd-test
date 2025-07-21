import { readFile, writeFile } from "node:fs/promises";
import type { Project } from "./config.js";

/**
 * Version file update utilities for different project types
 */

/**
 * Update version in package.json file
 */
export async function updateNpmVersion(
	projectPath: string,
	newVersion: string,
): Promise<void> {
	const packageJsonPath = `${projectPath}/package.json`;

	try {
		const content = await readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(content);

		packageJson.version = newVersion;

		await writeFile(
			packageJsonPath,
			`${JSON.stringify(packageJson, null, "\t")}\n`,
		);
	} catch (error) {
		throw new Error(
			`Failed to update version in ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Update version in Cargo.toml file (for future Rust support)
 */
export async function updateRustVersion(
	projectPath: string,
	newVersion: string,
): Promise<void> {
	const cargoTomlPath = `${projectPath}/Cargo.toml`;

	try {
		const content = await readFile(cargoTomlPath, "utf-8");

		// Simple regex replacement for version field
		const updatedContent = content.replace(
			/^version\s*=\s*"[^"]*"/m,
			`version = "${newVersion}"`,
		);

		await writeFile(cargoTomlPath, updatedContent);
	} catch (error) {
		throw new Error(
			`Failed to update version in ${cargoTomlPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Update version file based on project type
 */
export async function updateProjectVersion(
	project: Project,
	newVersion: string,
): Promise<void> {
	switch (project.type) {
		case "typescript":
			await updateNpmVersion(project.path, newVersion);
			break;
		case "rust":
			await updateRustVersion(project.path, newVersion);
			break;
		default:
			throw new Error(`Unsupported project type: ${project.type}`);
	}
}

/**
 * Get package name from package.json file
 */
export async function getPackageName(projectPath: string): Promise<string> {
	const packageJsonPath = `${projectPath}/package.json`;

	try {
		const content = await readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(content);

		if (!packageJson.name) {
			throw new Error(`Package name not found in ${packageJsonPath}`);
		}

		return packageJson.name;
	} catch (error) {
		throw new Error(
			`Failed to read package name from ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Update multiple project versions
 */
export async function updateMultipleProjectVersions(
	projects: Project[],
	versionUpdates: Record<string, string>,
): Promise<void> {
	const updatePromises = projects
		.filter((project) => project.path in versionUpdates)
		.map((project) => {
			const version = versionUpdates[project.path];
			if (!version) {
				throw new Error(`Version not found for project: ${project.path}`);
			}
			return updateProjectVersion(project, version);
		});

	await Promise.all(updatePromises);
}

if (import.meta.vitest) {
	const { expect, it, describe } = import.meta.vitest;

	describe("updateProjectVersion", () => {
		it("should throw error for unsupported project type", async () => {
			const unsupportedProject = {
				path: "unknown-project",
				type: "unknown",
				baseVersion: "1.0.0",
				deps: [],
				registries: [],
			};

			await expect(
				updateProjectVersion(unsupportedProject, "1.0.1"),
			).rejects.toThrow("Unsupported project type: unknown");
		});
	});

	describe("updateMultipleProjectVersions", () => {
		it("should filter projects correctly", () => {
			const projects = [
				{
					path: "package-a",
					type: "npm",
					baseVersion: "1.0.0",
					deps: [],
					registries: [],
				},
				{
					path: "package-b",
					type: "npm",
					baseVersion: "1.0.0",
					deps: [],
					registries: [],
				},
			];

			const versionUpdates = { "package-a": "1.0.1" };

			// Test that only projects with version updates are processed
			const filteredProjects = projects.filter(
				(project) => project.path in versionUpdates,
			);
			expect(filteredProjects).toHaveLength(1);
			expect(filteredProjects[0]?.path).toBe("package-a");
		});
	});
}
