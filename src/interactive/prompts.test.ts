import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInterface } from "node:readline/promises";
import {
	askYesNo,
	askInput,
	askChoice,
	askMultipleChoice,
	closePrompts,
} from "./prompts.js";

// Mock readline interface
vi.mock("node:readline/promises", () => ({
	createInterface: vi.fn(),
}));

const mockCreateInterface = vi.mocked(createInterface);

describe("interactive/prompts", () => {
	let mockReadline: {
		question: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		mockReadline = {
			question: vi.fn(),
			close: vi.fn(),
		};

		mockCreateInterface.mockReturnValue(mockReadline as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("askYesNo", () => {
		it("should return true for 'y' input", async () => {
			mockReadline.question.mockResolvedValue("y");

			const result = await askYesNo("Continue?");
			expect(result).toBe(true);
			expect(mockReadline.question).toHaveBeenCalledWith("Continue? [y/N] ");
		});

		it("should return true for 'yes' input", async () => {
			mockReadline.question.mockResolvedValue("yes");

			const result = await askYesNo("Continue?");
			expect(result).toBe(true);
		});

		it("should return true for 'Y' input (case insensitive)", async () => {
			mockReadline.question.mockResolvedValue("Y");

			const result = await askYesNo("Continue?");
			expect(result).toBe(true);
		});

		it("should return false for 'n' input", async () => {
			mockReadline.question.mockResolvedValue("n");

			const result = await askYesNo("Continue?");
			expect(result).toBe(false);
		});

		it("should return false for 'no' input", async () => {
			mockReadline.question.mockResolvedValue("no");

			const result = await askYesNo("Continue?");
			expect(result).toBe(false);
		});

		it("should return default value for empty input", async () => {
			mockReadline.question.mockResolvedValue("");

			const result = await askYesNo("Continue?", true);
			expect(result).toBe(true);
			expect(mockReadline.question).toHaveBeenCalledWith("Continue? [Y/n] ");
		});

		it("should return false as default when not specified", async () => {
			mockReadline.question.mockResolvedValue("");

			const result = await askYesNo("Continue?");
			expect(result).toBe(false);
		});

		it("should handle whitespace input", async () => {
			mockReadline.question.mockResolvedValue("  ");

			const result = await askYesNo("Continue?", true);
			expect(result).toBe(true);
		});
	});

	describe("askInput", () => {
		it("should return user input", async () => {
			mockReadline.question.mockResolvedValue("test input");

			const result = await askInput("Enter value");
			expect(result).toBe("test input");
			expect(mockReadline.question).toHaveBeenCalledWith("Enter value: ");
		});

		it("should return default value for empty input", async () => {
			mockReadline.question.mockResolvedValue("");

			const result = await askInput("Enter value", "default");
			expect(result).toBe("default");
			expect(mockReadline.question).toHaveBeenCalledWith("Enter value [default]: ");
		});

		it("should trim whitespace from input", async () => {
			mockReadline.question.mockResolvedValue("  trimmed  ");

			const result = await askInput("Enter value");
			expect(result).toBe("trimmed");
		});

		it("should handle no default value", async () => {
			mockReadline.question.mockResolvedValue("user input");

			const result = await askInput("Enter value");
			expect(result).toBe("user input");
			expect(mockReadline.question).toHaveBeenCalledWith("Enter value: ");
		});

		it("should return empty string for empty input with no default", async () => {
			mockReadline.question.mockResolvedValue("");

			const result = await askInput("Enter value");
			expect(result).toBe("");
		});
	});

	describe("askChoice", () => {
		const choices = [
			{ name: "Option 1", value: "opt1" },
			{ name: "Option 2", value: "opt2" },
			{ name: "Option 3", value: "opt3" },
		];

		it("should return selected choice value", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("2");

			const result = await askChoice("Select option:", choices);
			expect(result).toBe("opt2");

			expect(consoleSpy).toHaveBeenCalledWith("Select option:");
			expect(consoleSpy).toHaveBeenCalledWith("  1. Option 1");
			expect(consoleSpy).toHaveBeenCalledWith("  2. Option 2");
			expect(consoleSpy).toHaveBeenCalledWith("  3. Option 3");

			consoleSpy.mockRestore();
		});

		it("should handle first option selection", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("1");

			const result = await askChoice("Select option:", choices);
			expect(result).toBe("opt1");

			consoleSpy.mockRestore();
		});

		it("should handle last option selection", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("3");

			const result = await askChoice("Select option:", choices);
			expect(result).toBe("opt3");

			consoleSpy.mockRestore();
		});

		it("should retry on invalid input", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question
				.mockResolvedValueOnce("0") // Invalid - too low
				.mockResolvedValueOnce("4") // Invalid - too high
				.mockResolvedValueOnce("invalid") // Invalid - not a number
				.mockResolvedValueOnce("2"); // Valid

			const result = await askChoice("Select option:", choices);
			expect(result).toBe("opt2");

			expect(consoleSpy).toHaveBeenCalledWith("Invalid selection. Please try again.");
			expect(mockReadline.question).toHaveBeenCalledTimes(4);

			consoleSpy.mockRestore();
		});

		it("should handle single choice", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const singleChoice = [{ name: "Only Option", value: "only" }];
			mockReadline.question.mockResolvedValue("1");

			const result = await askChoice("Select:", singleChoice);
			expect(result).toBe("only");

			consoleSpy.mockRestore();
		});
	});

	describe("askMultipleChoice", () => {
		const choices = [
			{ name: "Option 1", value: "opt1" },
			{ name: "Option 2", value: "opt2" },
			{ name: "Option 3", value: "opt3" },
		];

		it("should return multiple selected values", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("1 3");

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1", "opt3"]);

			expect(consoleSpy).toHaveBeenCalledWith("Select options:");
			expect(consoleSpy).toHaveBeenCalledWith("  1. Option 1");
			expect(consoleSpy).toHaveBeenCalledWith("  2. Option 2");
			expect(consoleSpy).toHaveBeenCalledWith("  3. Option 3");

			consoleSpy.mockRestore();
		});

		it("should handle single selection", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("2");

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt2"]);

			consoleSpy.mockRestore();
		});

		it("should handle all selections", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("1 2 3");

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1", "opt2", "opt3"]);

			consoleSpy.mockRestore();
		});

		it("should handle whitespace and extra spaces", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("  1   3  ");

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1", "opt3"]);

			consoleSpy.mockRestore();
		});

		it("should retry on invalid input", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question
				.mockResolvedValueOnce("0 1") // Invalid - contains 0
				.mockResolvedValueOnce("1 4") // Invalid - contains 4
				.mockResolvedValueOnce("invalid") // Invalid - not numbers
				.mockResolvedValueOnce("1 2"); // Valid

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1", "opt2"]);

			expect(consoleSpy).toHaveBeenCalledWith("Invalid selection. Please try again.");
			expect(mockReadline.question).toHaveBeenCalledTimes(4);

			consoleSpy.mockRestore();
		});

		it("should handle duplicate selections", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question.mockResolvedValue("1 1 2 1");

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1", "opt1", "opt2", "opt1"]);

			consoleSpy.mockRestore();
		});

		it("should handle empty selection gracefully", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			mockReadline.question
				.mockResolvedValueOnce("") // Empty input
				.mockResolvedValueOnce("1"); // Valid

			const result = await askMultipleChoice("Select options:", choices);
			expect(result).toEqual(["opt1"]);

			consoleSpy.mockRestore();
		});
	});

	describe("closePrompts", () => {
		it("should call close on readline interface", () => {
			closePrompts();
			expect(mockReadline.close).toHaveBeenCalled();
		});
	});
});