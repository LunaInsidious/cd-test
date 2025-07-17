import { mkdir, readFile, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(path: string): Promise<void> {
	try {
		await mkdir(path, { recursive: true });
	} catch (error) {
		// Directory might already exist, check if it's actually an error
		if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
			throw error;
		}
	}
}

/**
 * Write content to a file, ensuring the directory exists
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
	const dir = dirname(filePath);
	await ensureDir(dir);
	await fsWriteFile(filePath, content, "utf8");
}

/**
 * Read content from a file
 */
export async function readFileContent(filePath: string): Promise<string> {
	return await readFile(filePath, "utf8");
}

/**
 * Update package.json version field
 */
export async function updatePackageVersion(
	packagePath: string,
	newVersion: string,
): Promise<void> {
	const content = await readFileContent(packagePath);
	const packageJson = JSON.parse(content) as { version: string };
	packageJson.version = newVersion;
	await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
}

/**
 * Update Cargo.toml version field
 */
export async function updateCargoVersion(
	cargoPath: string,
	newVersion: string,
): Promise<void> {
	const content = await readFileContent(cargoPath);
	const lines = content.split("\n");
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line && line.startsWith("version = ")) {
			lines[i] = `version = "${newVersion}"`;
			break;
		}
	}
	
	await writeFile(cargoPath, lines.join("\n"));
}

/**
 * Get all workspace projects from package.json workspaces field
 */
export async function getWorkspaceProjects(): Promise<string[]> {
	try {
		const content = await readFileContent("package.json");
		const packageJson = JSON.parse(content) as { workspaces?: string[] };
		return packageJson.workspaces || [];
	} catch {
		return [];
	}
}