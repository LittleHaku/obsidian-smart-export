import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			include: ["benchmarks/**/*.bench.ts"],
			coverage: {
				enabled: false,
			},
		},
	})
);
