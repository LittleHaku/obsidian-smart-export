import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const vitestGlobals = {
	afterAll: "readonly",
	afterEach: "readonly",
	beforeAll: "readonly",
	beforeEach: "readonly",
	describe: "readonly",
	expect: "readonly",
	it: "readonly",
	vi: "readonly",
};

export default defineConfig([
	{
		ignores: [
			"node_modules/",
			"coverage/",
			"docs/",
			".husky/",
			"main.js",
			"**/*.map",
			"*.js",
			"*.mjs",
			"**/*.config.*",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: "./tsconfig.eslint.json",
				tsconfigRootDir: process.cwd(),
			},
		},
		rules: {
			"no-undef": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			"no-prototype-builtins": "off",
		},
	},
	{
		files: ["tests/**/*.ts", "tests/**/*.tsx"],
		languageOptions: {
			globals: vitestGlobals,
		},
		rules: {
			"import/no-extraneous-dependencies": "off",
		},
	},
	{
		files: ["benchmarks/**/*", "scripts/**/*"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/prefer-window-timers": "off",
		},
	},
	{
		files: ["tests/scripts/**/*"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
		},
	},
]);
