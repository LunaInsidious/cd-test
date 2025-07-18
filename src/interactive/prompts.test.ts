import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock readline to prevent actual user input during tests
const mockQuestion = vi.fn();
const mockClose = vi.fn();
const mockCreateInterface = vi.fn(() => ({
	question: mockQuestion,
	close: mockClose,
}));

vi.mock("node:readline", () => ({
	createInterface: mockCreateInterface,
}));

// Import after mocking
import {
	askYesNo,
	askInput,
	askChoice,
	askMultipleChoice,
	closePrompts,
} from "./prompts.js";

describe("interactive/prompts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("askYesNo behavior", () => {
		it("should handle yes/no logic correctly", async () => {
			const testCases = [
				{ input: "y", expected: true },
				{ input: "yes", expected: true },
				{ input: "Y", expected: true },
				{ input: "YES", expected: true },
				{ input: "n", expected: false },
				{ input: "no", expected: false },
				{ input: "N", expected: false },
				{ input: "NO", expected: false },
			];

			for (const testCase of testCases) {
				mockQuestion.mockImplementationOnce((prompt, callback) => {
					callback(testCase.input);
				});

				const result = await askYesNo("Test question?");
				expect(result).toBe(testCase.expected);
			}
		});

		it("should handle default values correctly", async () => {
			// Test with default true
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback(""); // Empty input
			});
			const resultTrue = await askYesNo("Test?", true);
			expect(resultTrue).toBe(true);

			// Test with default false
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback(""); // Empty input
			});
			const resultFalse = await askYesNo("Test?", false);
			expect(resultFalse).toBe(false);
		});

		it("should format prompts correctly", async () => {
			mockQuestion.mockImplementation((prompt, callback) => {
				callback("y");
			});

			await askYesNo("Test question?", true);
			expect(mockQuestion).toHaveBeenCalledWith(
				"Test question? [Y/n]: ",
				expect.any(Function),
			);

			await askYesNo("Test question?", false);
			expect(mockQuestion).toHaveBeenCalledWith(
				"Test question? [y/N]: ",
				expect.any(Function),
			);
		});
	});

	describe("askInput behavior", () => {
		it("should handle input trimming", async () => {
			const testInputs = ["  test  ", " test ", "test", ""];
			const results: string[] = [];

			for (const input of testInputs) {
				mockQuestion.mockImplementationOnce((prompt, callback) => {
					callback(input);
				});
				const result = await askInput("Test:");
				results.push(result);
			}

			const trimmedResults = testInputs.map(input => input.trim());
			expect(results).toEqual(trimmedResults);
		});

		it("should handle default values", async () => {
			const emptyInput = "";
			const defaultValue = "default";

			// Test the logic that would be used in askInput
			const shouldUseDefault = emptyInput.trim() === "" && !!defaultValue;
			expect(shouldUseDefault).toBe(true);

			// Test actual askInput with default
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback("");
			});
			const result = await askInput("Test:", defaultValue);
			expect(result).toBe(defaultValue);
		});

		it("should format prompts with defaults", async () => {
			const question = "Enter value";
			const withDefault = `${question} [default]: `;
			const withoutDefault = `${question}: `;

			expect(withDefault).toBe("Enter value [default]: ");
			expect(withoutDefault).toBe("Enter value: ");

			// Test actual prompt formatting
			mockQuestion.mockImplementation((prompt, callback) => {
				callback("test");
			});

			await askInput("Test question", "defaultValue");
			expect(mockQuestion).toHaveBeenCalledWith(
				"Test question [defaultValue]: ",
				expect.any(Function),
			);
		});
	});

	describe("askChoice behavior", () => {
		const choices = [
			{ name: "Option 1", value: "opt1" },
			{ name: "Option 2", value: "opt2" },
			{ name: "Option 3", value: "opt3" },
		];

		it("should validate choice indices correctly", async () => {
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback("1"); // Valid choice
			});

			const result = await askChoice("Choose:", choices);
			expect(result).toBe("opt1");
		});

		it("should parse user input to indices correctly", async () => {
			const testCases = [
				{ input: "1", expected: "opt1" },
				{ input: "2", expected: "opt2" },
				{ input: "3", expected: "opt3" },
			];

			for (const testCase of testCases) {
				mockQuestion.mockImplementationOnce((prompt, callback) => {
					callback(testCase.input);
				});

				const result = await askChoice("Choose:", choices);
				expect(result).toBe(testCase.expected);
			}
		});
	});

	describe("askMultipleChoice behavior", () => {
		const choices = [
			{ name: "Option 1", value: "opt1" },
			{ name: "Option 2", value: "opt2" },
			{ name: "Option 3", value: "opt3" },
		];

		it("should parse multiple selections correctly", async () => {
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback("1,2"); // Multiple choices
			});

			const result = await askMultipleChoice("Choose multiple:", choices);
			expect(result).toEqual(["opt1", "opt2"]);
		});

		it("should validate multiple selections", async () => {
			mockQuestion.mockImplementationOnce((prompt, callback) => {
				callback("1,3"); // Valid multiple choices
			});

			const result = await askMultipleChoice("Choose:", choices);
			expect(result).toEqual(["opt1", "opt3"]);
		});

		it("should map indices to values correctly", async () => {
			const testCases = [
				{ input: "1", expected: ["opt1"] },
				{ input: "1,2,3", expected: ["opt1", "opt2", "opt3"] },
				{ input: "2,1", expected: ["opt2", "opt1"] },
			];

			for (const testCase of testCases) {
				mockQuestion.mockImplementationOnce((prompt, callback) => {
					callback(testCase.input);
				});

				const result = await askMultipleChoice("Choose:", choices);
				expect(result).toEqual(testCase.expected);
			}
		});
	});

	describe("module structure", () => {
		it("should export all required functions", async () => {
			// Verify all functions are properly exported
			expect(typeof askYesNo).toBe("function");
			expect(typeof askInput).toBe("function");
			expect(typeof askChoice).toBe("function");
			expect(typeof askMultipleChoice).toBe("function");
			expect(typeof closePrompts).toBe("function");

			// Test that closePrompts works
			closePrompts();
			expect(mockClose).toHaveBeenCalled();
		});

		it("should have correct function signatures", async () => {
			// Test basic function calls work without errors
			mockQuestion.mockImplementation((prompt, callback) => {
				callback("test");
			});

			const yesNoResult = await askYesNo("Test?");
			expect(typeof yesNoResult).toBe("boolean");

			const inputResult = await askInput("Input:");
			expect(typeof inputResult).toBe("string");

			const choiceResult = await askChoice("Choose:", [
				{ name: "Test", value: "test" },
			]);
			expect(typeof choiceResult).toBe("string");

			const multiChoiceResult = await askMultipleChoice("Choose:", [
				{ name: "Test", value: "test" },
			]);
			expect(Array.isArray(multiChoiceResult)).toBe(true);
		});
	});
});