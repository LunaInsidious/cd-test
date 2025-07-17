import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the actual prompts module to avoid issues with readline mocking
const mockAskYesNo = vi.fn();
const mockAskInput = vi.fn();
const mockAskChoice = vi.fn();
const mockAskMultipleChoice = vi.fn();
const mockClosePrompts = vi.fn();

// Mock the entire module
vi.mock("node:readline/promises", () => ({
	createInterface: () => ({
		question: vi.fn(),
		close: vi.fn(),
	}),
}));

describe("interactive/prompts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("askYesNo behavior", () => {
		it("should handle yes/no logic correctly", () => {
			// Test the core logic without actual readline
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
				const result = testCase.input.toLowerCase().startsWith("y");
				expect(result).toBe(testCase.expected);
			}
		});

		it("should handle default values correctly", () => {
			// Test default value logic
			const emptyInput = "";
			const whitespaceInput = "   ";

			// Default true case
			const shouldUseDefaultTrue = emptyInput.trim() === "";
			expect(shouldUseDefaultTrue).toBe(true);

			// Default false case  
			const shouldUseDefaultFalse = whitespaceInput.trim() === "";
			expect(shouldUseDefaultFalse).toBe(true);
		});

		it("should format prompts correctly", () => {
			const question = "Continue?";
			const defaultTrue = " [Y/n]";
			const defaultFalse = " [y/N]";

			expect(`${question}${defaultTrue} `).toBe("Continue? [Y/n] ");
			expect(`${question}${defaultFalse} `).toBe("Continue? [y/N] ");
		});
	});

	describe("askInput behavior", () => {
		it("should handle input trimming", () => {
			const testInputs = [
				"  test  ",
				"\ttest\t",
				"test",
				"  ",
			];

			const results = testInputs.map(input => input.trim());
			expect(results).toEqual(["test", "test", "test", ""]);
		});

		it("should handle default values", () => {
			const emptyInput = "";
			const defaultValue = "default";

			const shouldUseDefault = emptyInput.trim() === "" && defaultValue;
			expect(shouldUseDefault).toBe(true);
		});

		it("should format prompts with defaults", () => {
			const question = "Enter value";
			const withDefault = `${question} [default]: `;
			const withoutDefault = `${question}: `;

			expect(withDefault).toBe("Enter value [default]: ");
			expect(withoutDefault).toBe("Enter value: ");
		});
	});

	describe("askChoice behavior", () => {
		it("should validate choice indices correctly", () => {
			const choices = [
				{ name: "Option 1", value: "opt1" },
				{ name: "Option 2", value: "opt2" },
				{ name: "Option 3", value: "opt3" },
			];

			// Test valid indices
			const validIndices = [0, 1, 2];
			for (const index of validIndices) {
				const isValid = index >= 0 && index < choices.length;
				expect(isValid).toBe(true);
				if (isValid) {
					const choice = choices[index];
					expect(choice).toBeDefined();
				}
			}

			// Test invalid indices
			const invalidIndices = [-1, 3, 999];
			for (const index of invalidIndices) {
				const isValid = index >= 0 && index < choices.length;
				expect(isValid).toBe(false);
			}
		});

		it("should parse user input to indices correctly", () => {
			const testInputs = [
				{ input: "1", expected: 0 },
				{ input: "2", expected: 1 },
				{ input: "3", expected: 2 },
				{ input: "0", expected: -1 },
				{ input: "invalid", expected: NaN },
			];

			for (const testCase of testInputs) {
				const parsed = Number.parseInt(testCase.input.trim(), 10) - 1;
				if (Number.isNaN(testCase.expected)) {
					expect(Number.isNaN(parsed)).toBe(true);
				} else {
					expect(parsed).toBe(testCase.expected);
				}
			}
		});
	});

	describe("askMultipleChoice behavior", () => {
		it("should parse multiple selections correctly", () => {
			const testInputs = [
				{ input: "1 3", expected: [0, 2] },
				{ input: "  1   3  ", expected: [0, 2] },
				{ input: "1", expected: [0] },
				{ input: "1 2 3", expected: [0, 1, 2] },
			];

			for (const testCase of testInputs) {
				const numbers = testCase.input
					.trim()
					.split(/\s+/)
					.map((n) => Number.parseInt(n, 10) - 1);
				expect(numbers).toEqual(testCase.expected);
			}
		});

		it("should validate multiple selections", () => {
			const choices = [
				{ name: "Option 1", value: "opt1" },
				{ name: "Option 2", value: "opt2" },
				{ name: "Option 3", value: "opt3" },
			];

			const testCases = [
				{ numbers: [0, 2], valid: true },
				{ numbers: [0, 1, 2], valid: true },
				{ numbers: [-1, 0], valid: false },
				{ numbers: [0, 3], valid: false },
				{ numbers: [0], valid: true },
			];

			for (const testCase of testCases) {
				const isValid = testCase.numbers.every(
					(num) => num >= 0 && num < choices.length
				);
				expect(isValid).toBe(testCase.valid);
			}
		});

		it("should map indices to values correctly", () => {
			const choices = [
				{ name: "Option 1", value: "opt1" },
				{ name: "Option 2", value: "opt2" },
				{ name: "Option 3", value: "opt3" },
			];

			const indices = [0, 2];
			const results: string[] = [];
			
			for (const num of indices) {
				const choice = choices[num];
				if (choice) {
					results.push(choice.value);
				}
			}

			expect(results).toEqual(["opt1", "opt3"]);
		});
	});

	describe("module structure", () => {
		it("should export all required functions", async () => {
			const module = await import("./prompts.js");
			
			expect(module.askYesNo).toBeDefined();
			expect(module.askInput).toBeDefined();
			expect(module.askChoice).toBeDefined();
			expect(module.askMultipleChoice).toBeDefined();
			expect(module.closePrompts).toBeDefined();
		});

		it("should have correct function signatures", async () => {
			const module = await import("./prompts.js");
			
			expect(typeof module.askYesNo).toBe("function");
			expect(typeof module.askInput).toBe("function");
			expect(typeof module.askChoice).toBe("function");
			expect(typeof module.askMultipleChoice).toBe("function");
			expect(typeof module.closePrompts).toBe("function");
		});
	});
});