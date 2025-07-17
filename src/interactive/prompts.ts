import { createInterface } from "node:readline/promises";

const readline = createInterface({
	input: process.stdin,
	output: process.stdout,
});

/**
 * Ask user a yes/no question
 */
export async function askYesNo(
	question: string,
	defaultValue = false,
): Promise<boolean> {
	const suffix = defaultValue ? " [Y/n]" : " [y/N]";
	const answer = await readline.question(`${question}${suffix} `);

	if (answer.trim() === "") {
		return defaultValue;
	}

	return answer.toLowerCase().startsWith("y");
}

/**
 * Ask user to input a string value
 */
export async function askInput(
	question: string,
	defaultValue?: string,
): Promise<string> {
	const suffix = defaultValue ? ` [${defaultValue}]` : "";
	const answer = await readline.question(`${question}${suffix}: `);

	if (answer.trim() === "" && defaultValue) {
		return defaultValue;
	}

	return answer.trim();
}

/**
 * Ask user to select from multiple choices
 */
export async function askChoice<T>(
	question: string,
	choices: Array<{ name: string; value: T }>,
): Promise<T> {
	console.log(question);
	for (let i = 0; i < choices.length; i++) {
		const choice = choices[i];
		if (choice) {
			console.log(`  ${i + 1}. ${choice.name}`);
		}
	}

	while (true) {
		const answer = await readline.question("Please select (number): ");
		const index = Number.parseInt(answer.trim(), 10) - 1;

		if (index >= 0 && index < choices.length) {
			const choice = choices[index];
			if (choice) {
				return choice.value;
			}
		}

		console.log("Invalid selection. Please try again.");
	}
}

/**
 * Ask user to select multiple choices
 */
export async function askMultipleChoice<T>(
	question: string,
	choices: Array<{ name: string; value: T }>,
): Promise<T[]> {
	console.log(question);
	for (let i = 0; i < choices.length; i++) {
		const choice = choices[i];
		if (choice) {
			console.log(`  ${i + 1}. ${choice.name}`);
		}
	}
	console.log(
		"Enter numbers separated by spaces (e.g., '1 3' for first and third):",
	);

	while (true) {
		const answer = await readline.question("Selection: ");
		const numbers = answer
			.trim()
			.split(/\s+/)
			.map((n) => Number.parseInt(n, 10));

		if (numbers.every((num) => num >= 1 && num <= choices.length)) {
			const results: T[] = [];
			for (const num of numbers) {
				const choice = choices[num - 1];
				if (choice) {
					results.push(choice.value);
				}
			}
			return results;
		}

		console.log("Invalid selection. Please try again.");
	}
}

/**
 * Close the readline interface (call this when done)
 */
export function closePrompts(): void {
	readline.close();
}
