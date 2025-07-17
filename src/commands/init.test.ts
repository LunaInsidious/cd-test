import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initCommand } from "./init.js";

// Mock interactive prompts
vi.mock("../interactive/prompts.js", () => ({
	askYesNo: vi.fn(),
	askMultipleChoice: vi.fn(),
}));

// Mock fs/utils to prevent actual file operations
vi.mock("../fs/utils.js", () => ({
	ensureDir: vi.fn(),
	writeFile: vi.fn(),
}));

const mockAskYesNo = vi.mocked((await import("../interactive/prompts.js")).askYesNo);
const mockAskMultipleChoice = vi.mocked((await import("../interactive/prompts.js")).askMultipleChoice);
const mockEnsureDir = vi.mocked((await import("../fs/utils.js")).ensureDir);
const mockWriteFile = vi.mocked((await import("../fs/utils.js")).writeFile);

describe("commands/init", () => {
	let testDir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		testDir = join(tmpdir(), `cd-tools-init-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
		
		// Mock console.log to capture output
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		
		vi.clearAllMocks();
		
		// Default mock implementations
		mockAskYesNo.mockResolvedValue(false);
		mockAskMultipleChoice.mockResolvedValue(["npm"]);
		mockEnsureDir.mockResolvedValue();
		mockWriteFile.mockResolvedValue();
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		
		consoleSpy.mockRestore();
		vi.resetAllMocks();
	});

	describe("initCommand", () => {
		it("should initialize project with default configuration", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm"]);

			await initCommand();

			// Should create .github/workflows directory
			expect(mockEnsureDir).toHaveBeenCalledWith(".github/workflows");
			
			// Should create npm workflow
			expect(mockWriteFile).toHaveBeenCalledWith(
				".github/workflows/npm-release.yml",
				expect.stringContaining("NPM Release")
			);
			
			// Should create config file
			expect(mockWriteFile).toHaveBeenCalledWith(
				".cdtools/config.json",
				expect.stringContaining('"baseVersion": "1.0.0"')
			);

			// Should log success messages
			expect(consoleSpy).toHaveBeenCalledWith("🚀 Initializing CD tools configuration...");
			expect(consoleSpy).toHaveBeenCalledWith("✅ Created .github/workflows/npm-release.yml");
			expect(consoleSpy).toHaveBeenCalledWith("✅ Created .cdtools/config.json");
			expect(consoleSpy).toHaveBeenCalledWith("🎉 CD tools initialization complete!");
		});

		it("should handle multiple registry selection", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm", "crates", "container"]);

			await initCommand();

			// Should create all three workflows
			expect(mockWriteFile).toHaveBeenCalledWith(
				".github/workflows/npm-release.yml",
				expect.stringContaining("NPM Release")
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				".github/workflows/crates-release.yml",
				expect.stringContaining("Crates.io Release")
			);
			expect(mockWriteFile).toHaveBeenCalledWith(
				".github/workflows/container-release.yml",
				expect.stringContaining("Container Registry Release")
			);

			// Should create config with all project types
			const configCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".cdtools/config.json"
			);
			expect(configCall).toBeDefined();
			const configContent = JSON.parse(configCall![1]);
			
			expect(configContent.projects).toHaveLength(3);
			expect(configContent.projects).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ type: "typescript", registries: ["npm"] }),
					expect.objectContaining({ type: "rust", registries: ["crates"] }),
					expect.objectContaining({ type: "container", registries: ["container"] }),
				])
			);
		});

		it("should handle existing .cdtools directory with overwrite", async () => {
			// Mock readdir to simulate existing files
			mockEnsureDir.mockImplementationOnce(async () => {
				const fs = await import("node:fs/promises");
				fs.readdir = vi.fn().mockResolvedValue(["existing-file.json"]);
			});
			
			mockAskYesNo.mockResolvedValue(true); // User chooses to overwrite
			mockAskMultipleChoice.mockResolvedValue(["npm"]);

			await initCommand();

			expect(mockAskYesNo).toHaveBeenCalledWith(
				".cdtools directory already exists. Overwrite?",
			);
			
			// Should continue with initialization
			expect(mockWriteFile).toHaveBeenCalledWith(
				".cdtools/config.json",
				expect.any(String)
			);
		});

		it("should cancel initialization if user declines overwrite", async () => {
			// Mock readdir to simulate existing files
			mockEnsureDir.mockImplementationOnce(async () => {
				const fs = await import("node:fs/promises");
				fs.readdir = vi.fn().mockResolvedValue(["existing-file.json"]);
			});
			
			mockAskYesNo.mockResolvedValue(false); // User chooses not to overwrite

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith("❌ Initialization cancelled");
			
			// Should not create any files
			expect(mockWriteFile).not.toHaveBeenCalled();
		});

		it("should generate correct npm workflow content", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm"]);

			await initCommand();

			const workflowCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".github/workflows/npm-release.yml"
			);
			expect(workflowCall).toBeDefined();
			
			const workflowContent = workflowCall![1];
			expect(workflowContent).toContain("name: NPM Release");
			expect(workflowContent).toContain("uses: actions/setup-node@v4");
			expect(workflowContent).toContain("npm ci");
			expect(workflowContent).toContain("npm test");
			expect(workflowContent).toContain("npm publish");
			expect(workflowContent).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
		});

		it("should generate correct crates workflow content", async () => {
			mockAskMultipleChoice.mockResolvedValue(["crates"]);

			await initCommand();

			const workflowCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".github/workflows/crates-release.yml"
			);
			expect(workflowCall).toBeDefined();
			
			const workflowContent = workflowCall![1];
			expect(workflowContent).toContain("name: Crates.io Release");
			expect(workflowContent).toContain("uses: actions-rs/toolchain@v1");
			expect(workflowContent).toContain("cargo build --release");
			expect(workflowContent).toContain("cargo test");
			expect(workflowContent).toContain("cargo publish");
			expect(workflowContent).toContain("CARGO_REGISTRY_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN }}");
		});

		it("should generate correct container workflow content", async () => {
			mockAskMultipleChoice.mockResolvedValue(["container"]);

			await initCommand();

			const workflowCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".github/workflows/container-release.yml"
			);
			expect(workflowCall).toBeDefined();
			
			const workflowContent = workflowCall![1];
			expect(workflowContent).toContain("name: Container Registry Release");
			expect(workflowContent).toContain("uses: docker/setup-buildx-action@v3");
			expect(workflowContent).toContain("uses: docker/login-action@v3");
			expect(workflowContent).toContain("uses: docker/build-push-action@v5");
			expect(workflowContent).toContain("ghcr.io/${{ github.repository }}");
		});

		it("should generate default config when no registries selected", async () => {
			mockAskMultipleChoice.mockResolvedValue([]);

			await initCommand();

			const configCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".cdtools/config.json"
			);
			expect(configCall).toBeDefined();
			
			const configContent = JSON.parse(configCall![1]);
			expect(configContent.projects).toHaveLength(1);
			expect(configContent.projects[0]).toEqual({
				path: "./",
				type: "typescript",
				registries: ["npm"],
			});
		});

		it("should generate correct default configuration structure", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm"]);

			await initCommand();

			const configCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".cdtools/config.json"
			);
			expect(configCall).toBeDefined();
			
			const configContent = JSON.parse(configCall![1]);
			
			expect(configContent).toEqual({
				baseVersion: "1.0.0",
				versionTags: [
					{
						alpha: {
							versionSuffixStrategy: "timestamp",
						},
					},
					{
						rc: {
							versionSuffixStrategy: "increment",
							next: "stable",
						},
					},
				],
				projects: [
					{
						path: "./frontend",
						type: "typescript",
						registries: ["npm"],
					},
				],
				releaseNotes: {
					enabled: true,
					template: "## Changes\n\n{{changes}}\n\n## Contributors\n\n{{contributors}}",
				},
			});
		});

		it("should display helpful next steps", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm"]);

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith("Next steps:");
			expect(consoleSpy).toHaveBeenCalledWith("1. Edit .cdtools/config.json to match your project structure");
			expect(consoleSpy).toHaveBeenCalledWith("2. Run 'cd-tools start-pr' to begin a release");
		});
	});
});