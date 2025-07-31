import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import {
	type BranchInfo,
	LIB_DIR,
	loadBranchInfo,
	updateBranchInfo,
} from "./config.js";

// Mock Date for predictable timestamps
let mockDate: MockInstance;
const testDir = "/tmp/cd-tools-config-test";
const cdtoolsDir = join(testDir, LIB_DIR);

describe("updateBranchInfo", () => {
	beforeEach(async () => {
		// Clean up and create test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Directory might not exist
		}
		await mkdir(testDir, { recursive: true });
		await mkdir(cdtoolsDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);

		// Mock Date for predictable timestamps
		mockDate = vi.spyOn(Date.prototype, "toISOString");
	});

	afterEach(async () => {
		mockDate.mockRestore();
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should preserve existing updatedAt for unchanged projects", async () => {
		const originalTime = "2023-12-25T10:30:45.123Z";
		const newTime = "2023-12-25T11:30:45.123Z";

		// Create initial branch info with existing project
		const initialBranchInfo: BranchInfo = {
			tag: "alpha",
			parentBranch: "main",
			projectUpdated: {
				"project-a": {
					version: "1.0.0-alpha.1",
					updatedAt: originalTime,
				},
				"project-b": {
					version: "2.0.0-alpha.1",
					updatedAt: originalTime,
				},
			},
		};

		const branchInfoPath = join(cdtoolsDir, "alpha-test.json");
		await writeFile(
			branchInfoPath,
			JSON.stringify(initialBranchInfo, null, "\t"),
		);

		// Mock current time
		mockDate.mockReturnValue(newTime);

		// Update only project-a with new version, keep project-b unchanged
		await updateBranchInfo("test(alpha)", {
			"project-a": "1.0.1-alpha.1", // Changed version
			"project-b": "2.0.0-alpha.1", // Same version
		});

		// Load updated branch info
		const updatedBranchInfo = await loadBranchInfo("test(alpha)");

		expect(updatedBranchInfo.projectUpdated).toEqual({
			"project-a": {
				version: "1.0.1-alpha.1",
				updatedAt: newTime, // Should be updated because version changed
			},
			"project-b": {
				version: "2.0.0-alpha.1",
				updatedAt: originalTime, // Should preserve original timestamp
			},
		});
	});

	it("should update updatedAt for new projects", async () => {
		const originalTime = "2023-12-25T10:30:45.123Z";
		const newTime = "2023-12-25T11:30:45.123Z";

		// Create initial branch info with one project
		const initialBranchInfo: BranchInfo = {
			tag: "alpha",
			parentBranch: "main",
			projectUpdated: {
				"project-a": {
					version: "1.0.0-alpha.1",
					updatedAt: originalTime,
				},
			},
		};

		const branchInfoPath = join(cdtoolsDir, "alpha-test.json");
		await writeFile(
			branchInfoPath,
			JSON.stringify(initialBranchInfo, null, "\t"),
		);

		// Mock current time
		mockDate.mockReturnValue(newTime);

		// Add a new project
		await updateBranchInfo("test(alpha)", {
			"project-a": "1.0.0-alpha.1", // Same version
			"project-c": "3.0.0-alpha.1", // New project
		});

		// Load updated branch info
		const updatedBranchInfo = await loadBranchInfo("test(alpha)");

		expect(updatedBranchInfo.projectUpdated).toEqual({
			"project-a": {
				version: "1.0.0-alpha.1",
				updatedAt: originalTime, // Should preserve original timestamp
			},
			"project-c": {
				version: "3.0.0-alpha.1",
				updatedAt: newTime, // Should have new timestamp for new project
			},
		});
	});

	it("should update updatedAt when version changes", async () => {
		const originalTime = "2023-12-25T10:30:45.123Z";
		const newTime = "2023-12-25T11:30:45.123Z";

		// Create initial branch info
		const initialBranchInfo: BranchInfo = {
			tag: "alpha",
			parentBranch: "main",
			projectUpdated: {
				"project-a": {
					version: "1.0.0-alpha.1",
					updatedAt: originalTime,
				},
			},
		};

		const branchInfoPath = join(cdtoolsDir, "alpha-test.json");
		await writeFile(
			branchInfoPath,
			JSON.stringify(initialBranchInfo, null, "\t"),
		);

		// Mock current time
		mockDate.mockReturnValue(newTime);

		// Update with changed version
		await updateBranchInfo("test(alpha)", {
			"project-a": "1.0.1-alpha.1", // Changed version
		});

		// Load updated branch info
		const updatedBranchInfo = await loadBranchInfo("test(alpha)");

		expect(updatedBranchInfo.projectUpdated).toEqual({
			"project-a": {
				version: "1.0.1-alpha.1",
				updatedAt: newTime, // Should be updated because version changed
			},
		});
	});

	it("should handle branch info with no existing projectUpdated", async () => {
		const newTime = "2023-12-25T11:30:45.123Z";

		// Create initial branch info without projectUpdated
		const initialBranchInfo: BranchInfo = {
			tag: "alpha",
			parentBranch: "main",
		};

		const branchInfoPath = join(cdtoolsDir, "alpha-test.json");
		await writeFile(
			branchInfoPath,
			JSON.stringify(initialBranchInfo, null, "\t"),
		);

		// Mock current time
		mockDate.mockReturnValue(newTime);

		// Add projects for first time
		await updateBranchInfo("test(alpha)", {
			"project-a": "1.0.0-alpha.1",
			"project-b": "2.0.0-alpha.1",
		});

		// Load updated branch info
		const updatedBranchInfo = await loadBranchInfo("test(alpha)");

		expect(updatedBranchInfo.projectUpdated).toEqual({
			"project-a": {
				version: "1.0.0-alpha.1",
				updatedAt: newTime,
			},
			"project-b": {
				version: "2.0.0-alpha.1",
				updatedAt: newTime,
			},
		});
	});
});
