import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			include: ["src/**/*.ts"],
			exclude: ["src/types.ts"],
			thresholds: {
				statements: 100,
				branches: 100,
				functions: 100,
				lines: 100,
			},
		},
	},
	resolve: {
		alias: {
			obsidian: path.resolve(__dirname, "tests/mocks/obsidian.ts"),
		},
	},
});
