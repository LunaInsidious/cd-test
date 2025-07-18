import {
	writeFile as fsWriteFile,
	mkdir,
	readFile,
	rm,
	rmdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ensureDir,
	getWorkspaceProjects,
	readFileContent,
	updateCargoVersion,
	updatePackageVersion,
	writeFile,
} from "./utils.js";

describe("fs/utils", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `cd-tools-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("ensureDir", () => {
		it("should create a directory if it doesn't exist", async () => {
			const dirPath = join(testDir, "new-dir");
			await ensureDir(dirPath);

			// Verify directory exists by trying to read it
			const stats = await readFile(dirPath).catch(() => null);
			expect(stats).toBe(null); // Directory exists but is empty
		});

		it("should not throw if directory already exists", async () => {
			const dirPath = join(testDir, "existing-dir");
			await mkdir(dirPath);

			// Should not throw
			await expect(ensureDir(dirPath)).resolves.toBeUndefined();
		});

		it("should create nested directories", async () => {
			const nestedPath = join(testDir, "level1", "level2", "level3");
			await ensureDir(nestedPath);

			// Verify nested directory exists
			const stats = await readFile(nestedPath).catch(() => null);
			expect(stats).toBe(null); // Directory exists but is empty
		});
	});

	describe("writeFile", () => {
		it("should write content to a file", async () => {
			const filePath = join(testDir, "test.txt");
			const content = "Hello, World!";

			await writeFile(filePath, content);

			const readContent = await readFile(filePath, "utf8");
			expect(readContent).toBe(content);
		});

		it("should create directory if it doesn't exist", async () => {
			const filePath = join(testDir, "nested", "dirs", "test.txt");
			const content = "Test content";

			await writeFile(filePath, content);

			const readContent = await readFile(filePath, "utf8");
			expect(readContent).toBe(content);
		});

		it("should overwrite existing file", async () => {
			const filePath = join(testDir, "test.txt");

			await writeFile(filePath, "Original content");
			await writeFile(filePath, "Updated content");

			const readContent = await readFile(filePath, "utf8");
			expect(readContent).toBe("Updated content");
		});
	});

	describe("readFileContent", () => {
		it("should read file content", async () => {
			const filePath = join(testDir, "test.txt");
			const content = "Test file content";

			await fsWriteFile(filePath, content, "utf8");

			const readContent = await readFileContent(filePath);
			expect(readContent).toBe(content);
		});

		it("should throw error for non-existent file", async () => {
			const filePath = join(testDir, "non-existent.txt");

			await expect(readFileContent(filePath)).rejects.toThrow();
		});
	});

	describe("updatePackageVersion", () => {
		it("should update version in package.json", async () => {
			const packagePath = join(testDir, "package.json");
			const originalPackage = {
				name: "test-package",
				version: "1.0.0",
				description: "Test package",
			};

			await fsWriteFile(packagePath, JSON.stringify(originalPackage, null, 2));

			await updatePackageVersion(packagePath, "2.0.0");

			const updatedContent = await readFile(packagePath, "utf8");
			const updatedPackage = JSON.parse(
				updatedContent,
			) as typeof originalPackage;

			expect(updatedPackage.version).toBe("2.0.0");
			expect(updatedPackage.name).toBe("test-package");
			expect(updatedPackage.description).toBe("Test package");
		});

		it("should preserve formatting and other fields", async () => {
			const packagePath = join(testDir, "package.json");
			const originalPackage = {
				name: "test-package",
				version: "1.0.0",
				scripts: {
					test: "vitest",
					build: "tsc",
				},
				dependencies: {
					typescript: "^5.0.0",
				},
			};

			await fsWriteFile(packagePath, JSON.stringify(originalPackage, null, 2));

			await updatePackageVersion(packagePath, "1.2.3");

			const updatedContent = await readFile(packagePath, "utf8");
			const updatedPackage = JSON.parse(
				updatedContent,
			) as typeof originalPackage;

			expect(updatedPackage.version).toBe("1.2.3");
			expect(updatedPackage.scripts).toEqual(originalPackage.scripts);
			expect(updatedPackage.dependencies).toEqual(originalPackage.dependencies);
		});

		it("should throw error for invalid JSON", async () => {
			const packagePath = join(testDir, "package.json");
			await fsWriteFile(packagePath, "invalid json content");

			await expect(
				updatePackageVersion(packagePath, "2.0.0"),
			).rejects.toThrow();
		});
	});

	describe("updateCargoVersion", () => {
		it("should update version in Cargo.toml", async () => {
			const cargoPath = join(testDir, "Cargo.toml");
			const originalContent = `[package]
name = "test-crate"
version = "1.0.0"
edition = "2021"

[dependencies]
serde = "1.0"`;

			await fsWriteFile(cargoPath, originalContent);

			await updateCargoVersion(cargoPath, "2.0.0");

			const updatedContent = await readFile(cargoPath, "utf8");
			expect(updatedContent).toContain('version = "2.0.0"');
			expect(updatedContent).toContain('name = "test-crate"');
			expect(updatedContent).toContain('serde = "1.0"');
		});

		it("should update first occurrence of version", async () => {
			const cargoPath = join(testDir, "Cargo.toml");
			const originalContent = `[package]
name = "test-crate"
version = "1.0.0"
edition = "2021"

# This is not a package version = "0.5.0"
[dependencies]
some-dep = { version = "0.3.0" }`;

			await fsWriteFile(cargoPath, originalContent);

			await updateCargoVersion(cargoPath, "3.0.0");

			const updatedContent = await readFile(cargoPath, "utf8");
			const lines = updatedContent.split("\n");

			// Should update the package version
			expect(lines[2]).toBe('version = "3.0.0"');
			// Should not update other version references
			expect(updatedContent).toContain('some-dep = { version = "0.3.0" }');
		});

		it("should preserve file structure and comments", async () => {
			const cargoPath = join(testDir, "Cargo.toml");
			const originalContent = `# Test Cargo.toml
[package]
name = "test-crate"
version = "1.0.0"
edition = "2021"
# Some comment

[dependencies]
# Dependencies section
serde = "1.0"`;

			await fsWriteFile(cargoPath, originalContent);

			await updateCargoVersion(cargoPath, "1.1.0");

			const updatedContent = await readFile(cargoPath, "utf8");
			expect(updatedContent).toContain("# Test Cargo.toml");
			expect(updatedContent).toContain("# Some comment");
			expect(updatedContent).toContain("# Dependencies section");
			expect(updatedContent).toContain('version = "1.1.0"');
		});
	});

	describe("getWorkspaceProjects", () => {
		it("should return workspaces from package.json", async () => {
			const packagePath = join(testDir, "package.json");
			const packageContent = {
				name: "monorepo",
				version: "1.0.0",
				workspaces: ["packages/*", "apps/*"],
			};

			await fsWriteFile(packagePath, JSON.stringify(packageContent, null, 2));

			// Change to test directory for this test
			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const workspaces = await getWorkspaceProjects();
				expect(workspaces).toEqual(["packages/*", "apps/*"]);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should return empty array if no workspaces field", async () => {
			const packagePath = join(testDir, "package.json");
			const packageContent = {
				name: "single-package",
				version: "1.0.0",
			};

			await fsWriteFile(packagePath, JSON.stringify(packageContent, null, 2));

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const workspaces = await getWorkspaceProjects();
				expect(workspaces).toEqual([]);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should return empty array if package.json doesn't exist", async () => {
			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const workspaces = await getWorkspaceProjects();
				expect(workspaces).toEqual([]);
			} finally {
				process.chdir(originalCwd);
			}
		});

		it("should return empty array for invalid JSON", async () => {
			const packagePath = join(testDir, "package.json");
			await fsWriteFile(packagePath, "invalid json");

			const originalCwd = process.cwd();
			process.chdir(testDir);

			try {
				const workspaces = await getWorkspaceProjects();
				expect(workspaces).toEqual([]);
			} finally {
				process.chdir(originalCwd);
			}
		});
	});
});
