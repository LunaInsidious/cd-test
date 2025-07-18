import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initCommand } from "./init.js";

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
}));

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

const mockReaddir = vi.mocked((await import("node:fs/promises")).readdir);
const mockAskYesNo = vi.mocked((await import("../interactive/prompts.js")).askYesNo);
const mockAskMultipleChoice = vi.mocked((await import("../interactive/prompts.js")).askMultipleChoice);
const mockEnsureDir = vi.mocked((await import("../fs/utils.js")).ensureDir);
const mockWriteFile = vi.mocked((await import("../fs/utils.js")).writeFile);

describe("commands/init", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		vi.clearAllMocks();

		// Default mock setups
		mockEnsureDir.mockResolvedValue();
		mockWriteFile.mockResolvedValue();
		mockReaddir.mockResolvedValue([]);
		mockAskMultipleChoice.mockResolvedValue(["npm"]);
		mockAskYesNo.mockResolvedValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initCommand", () => {
		it("should initialize project with default configuration", async () => {
			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith("🚀 Initializing CD tools configuration...");
			expect(mockEnsureDir).toHaveBeenCalledWith(".cdtools");
			expect(mockEnsureDir).toHaveBeenCalledWith(".github/workflows");
			expect(mockWriteFile).toHaveBeenCalledWith(".github/workflows/npm-release.yml", expect.any(String));
			expect(mockWriteFile).toHaveBeenCalledWith(".cdtools/config.json", expect.any(String));
			expect(consoleSpy).toHaveBeenCalledWith("🎉 CD tools initialization complete!");
		});

		it("should handle multiple registry selection", async () => {
			mockAskMultipleChoice.mockResolvedValue(["npm", "crates", "container"]);

			await initCommand();

			expect(mockWriteFile).toHaveBeenCalledWith(".github/workflows/npm-release.yml", expect.any(String));
			expect(mockWriteFile).toHaveBeenCalledWith(".github/workflows/crates-release.yml", expect.any(String));
			expect(mockWriteFile).toHaveBeenCalledWith(".github/workflows/container-release.yml", expect.any(String));

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
			mockReaddir.mockResolvedValue(["existing-file.json"] as any);
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
			mockReaddir.mockResolvedValue(["existing-file.json"] as any);
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
			expect(workflowContent).toContain("name: npm Release");
			expect(workflowContent).toContain("npm ci");
			expect(workflowContent).toContain("npm run build");
			expect(workflowContent).toContain("npm publish");
		});

		it("should generate correct crates workflow content", async () => {
			mockAskMultipleChoice.mockResolvedValue(["crates"]);

			await initCommand();

			const workflowCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".github/workflows/crates-release.yml"
			);
			expect(workflowCall).toBeDefined();
			
			const workflowContent = workflowCall![1];
			expect(workflowContent).toContain("name: crates.io Release");
			expect(workflowContent).toContain("cargo build");
			expect(workflowContent).toContain("cargo publish");
		});

		it("should generate correct container workflow content", async () => {
			mockAskMultipleChoice.mockResolvedValue(["container"]);

			await initCommand();

			const workflowCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".github/workflows/container-release.yml"
			);
			expect(workflowCall).toBeDefined();
			
			const workflowContent = workflowCall![1];
			expect(workflowContent).toContain("name: Container Release");
			expect(workflowContent).toContain("docker build");
			expect(workflowContent).toContain("docker push");
		});

		it("should generate default config when no registries selected", async () => {
			mockAskMultipleChoice.mockResolvedValue([]);

			await initCommand();

			const configCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".cdtools/config.json"
			);
			expect(configCall).toBeDefined();
			const configContent = JSON.parse(configCall![1]);
			
			expect(configContent.projects).toHaveLength(0);
			expect(configContent.baseVersion).toBe("1.0.0");
		});

		it("should generate correct default configuration structure", async () => {
			await initCommand();

			const configCall = mockWriteFile.mock.calls.find(call => 
				call[0] === ".cdtools/config.json"
			);
			expect(configCall).toBeDefined();
			const configContent = JSON.parse(configCall![1]);
			
			expect(configContent).toHaveProperty("baseVersion");
			expect(configContent).toHaveProperty("versionTags");
			expect(configContent).toHaveProperty("projects");
			expect(configContent).toHaveProperty("releaseNotes");
			
			expect(configContent.versionTags).toHaveLength(2); // alpha and rc
			expect(configContent.releaseNotes.enabled).toBe(true);
		});

		it("should display helpful next steps", async () => {
			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith("Next steps:");
			expect(consoleSpy).toHaveBeenCalledWith("1. Edit .cdtools/config.json to match your project structure");
			expect(consoleSpy).toHaveBeenCalledWith("2. Run 'cd-tools start-pr' to begin a release");
		});
	});
});