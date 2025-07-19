import { access, copyFile, mkdir } from "node:fs/promises";
import prompts from "prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initCommand } from "./init.js";

// Mock all external dependencies
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
	copyFile: vi.fn(),
	access: vi.fn(),
}));

vi.mock("prompts", () => ({
	default: vi.fn(),
}));

const mockMkdir = vi.mocked(mkdir);
const mockCopyFile = vi.mocked(copyFile);
const mockAccess = vi.mocked(access);
const mockPrompts = vi.mocked(prompts);

describe("initCommand", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		vi.restoreAllMocks();
	});

	describe("successful initialization", () => {
		it("should initialize with npm registry", async () => {
			// Mock file doesn't exist (access throws)
			mockAccess.mockRejectedValue(new Error("File not found"));
			// Mock prompts response
			mockPrompts.mockResolvedValue({ registries: ["npm"] });

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith(
				"🚀 Initializing CD tools configuration...",
			);
			expect(mockMkdir).toHaveBeenCalledWith(".cdtools", { recursive: true });
			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/config.json"),
				".cdtools/config.json",
			);
			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/publish-npm.yml"),
				".cdtools/publish-npm.yml",
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				"🎉 CD tools initialization complete!",
			);
		});

		it("should initialize with docker registry", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockPrompts.mockResolvedValue({ registries: ["docker"] });

			await initCommand();

			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/publish-container-image.yml"),
				".cdtools/publish-container-image.yml",
			);
		});

		it("should initialize with multiple registries", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockPrompts.mockResolvedValue({ registries: ["npm", "docker"] });

			await initCommand();

			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/publish-npm.yml"),
				".cdtools/publish-npm.yml",
			);
			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/publish-container-image.yml"),
				".cdtools/publish-container-image.yml",
			);
		});
	});

	describe("overwrite handling", () => {
		it("should prompt for overwrite when config exists and proceed if confirmed", async () => {
			mockAccess.mockResolvedValue(undefined); // File exists
			mockPrompts
				.mockResolvedValueOnce({ overwrite: true }) // Confirm overwrite
				.mockResolvedValueOnce({ registries: ["npm"] }); // Select registries

			await initCommand();

			expect(mockPrompts).toHaveBeenCalledWith({
				type: "confirm",
				name: "overwrite",
				message: ".cdtools/config.json already exists. Overwrite?",
				initial: false,
			});
			expect(mockCopyFile).toHaveBeenCalledWith(
				expect.stringContaining("default-files/config.json"),
				".cdtools/config.json",
			);
		});

		it("should cancel initialization when overwrite is declined", async () => {
			mockAccess.mockResolvedValue(undefined); // File exists
			mockPrompts.mockResolvedValue({ overwrite: false });

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith("❌ Initialization cancelled");
			expect(mockCopyFile).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle mkdir failure", async () => {
			mockMkdir.mockRejectedValue(new Error("Permission denied"));

			await expect(initCommand()).rejects.toThrow("process.exit called");

			expect(console.error).toHaveBeenCalledWith(
				"❌ Failed to create .cdtools directory:",
				expect.any(Error),
			);
			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it("should handle copyFile failure for config", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockCopyFile.mockRejectedValue(new Error("Copy failed"));

			await expect(initCommand()).rejects.toThrow("process.exit called");

			expect(console.error).toHaveBeenCalledWith(
				"❌ Failed to copy config.json:",
				expect.any(Error),
			);
			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it("should handle no registries selected", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockPrompts.mockResolvedValue({ registries: [] });

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith(
				"❌ No registries selected. Initialization cancelled.",
			);
		});

		it("should handle workflow copy failure gracefully", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockPrompts.mockResolvedValue({ registries: ["npm"] });
			mockCopyFile
				.mockResolvedValueOnce() // config copy succeeds
				.mockRejectedValueOnce(new Error("Workflow copy failed")); // workflow copy fails

			await initCommand();

			expect(console.error).toHaveBeenCalledWith(
				"❌ Failed to copy workflow for npm:",
				expect.any(Error),
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				"🎉 CD tools initialization complete!",
			);
		});
	});

	describe("registry selection", () => {
		it("should display correct prompt message", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			mockPrompts.mockResolvedValue({ registries: ["npm"] });

			await initCommand();

			expect(consoleSpy).toHaveBeenCalledWith(
				"Please select the registry you plan to release.",
			);
			expect(mockPrompts).toHaveBeenCalledWith({
				type: "multiselect",
				name: "registries",
				message: "Select target registries:",
				choices: [
					{ title: "npm", value: "npm" },
					{ title: "docker hub (ghcr.io)", value: "docker" },
				],
				min: 1,
			});
		});

		it("should handle unknown registry gracefully", async () => {
			mockAccess.mockRejectedValue(new Error("File not found"));
			// Mock an unknown registry somehow getting through
			mockPrompts.mockResolvedValue({ registries: ["unknown"] });

			await initCommand();

			expect(console.warn).toHaveBeenCalledWith("⚠️  Unknown registry: unknown");
			expect(consoleSpy).toHaveBeenCalledWith(
				"🎉 CD tools initialization complete!",
			);
		});
	});
});
