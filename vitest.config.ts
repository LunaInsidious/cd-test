import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		includeSource: ["src/**/*.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: ["node_modules/", "dist/"],
		},
	},
	define: {
		"import.meta.vitest": "undefined",
	},
});
