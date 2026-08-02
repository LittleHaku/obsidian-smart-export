// @vitest-environment node
/// <reference types="node" />

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const mobileCheckScript = path.join(repositoryRoot, "scripts", "check-mobile-compat.mjs");
const benchmarkCheckScript = path.join(repositoryRoot, "scripts", "check-benchmark-regression.mjs");
const temporaryDirectories: string[] = [];
const positiveLookbehind = ["(", "?", "<", "="].join("");
const negativeLookbehind = ["(", "?", "<", "!"].join("");

function createTemporaryDirectory(): string {
	const directory = mkdtempSync(path.join(tmpdir(), "smart-export-release-check-"));
	temporaryDirectories.push(directory);
	return directory;
}

function runNodeScript(script: string, args: string[], cwd: string) {
	return spawnSync(process.execPath, [script, ...args], {
		cwd,
		encoding: "utf8",
	});
}

function runMobileCheck(source: string) {
	const fixtureRoot = createTemporaryDirectory();
	mkdirSync(path.join(fixtureRoot, "src"));
	writeFileSync(
		path.join(fixtureRoot, "manifest.json"),
		`${JSON.stringify({ isDesktopOnly: false })}\n`
	);
	writeFileSync(path.join(fixtureRoot, "src", "fixture.ts"), `${source}\n`);
	return runNodeScript(mobileCheckScript, [], fixtureRoot);
}

function createBenchmarkReport(duration: number) {
	return {
		traversalMedianMs: duration,
		xmlMedianMs: duration,
		llmMedianMs: duration,
		printMedianMs: duration,
		tagColdMedianMs: duration,
		estimatedTraversalSpeedup: 10,
	};
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("release validation scripts", () => {
	it.each([
		["RegExp call", `const pattern = RegExp("${positiveLookbehind}prefix)value");`],
		["RegExp constructor", `const pattern = new RegExp(\`${negativeLookbehind}prefix)value\`);`],
	])("rejects lookbehind in a static %s", (_name, source) => {
		const result = runMobileCheck(source);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("uses regular-expression lookbehind");
	});

	it("allows a mobile-safe RegExp constructor", () => {
		const result = runMobileCheck('const pattern = new RegExp("prefix.+value");');

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Mobile compatibility check passed");
	});

	it("anchors benchmark tolerances to the explicit policy file", () => {
		const fixtureRoot = createTemporaryDirectory();
		const baselineReportPath = path.join(fixtureRoot, "baseline-report.json");
		const currentReportPath = path.join(fixtureRoot, "current-report.json");
		const targetPolicyPath = path.join(fixtureRoot, "target-policy.json");
		const relaxedPolicyPath = path.join(fixtureRoot, "relaxed-policy.json");
		writeFileSync(baselineReportPath, JSON.stringify(createBenchmarkReport(100)));
		writeFileSync(currentReportPath, JSON.stringify(createBenchmarkReport(110)));
		writeFileSync(
			targetPolicyPath,
			JSON.stringify({
				tolerances: {
					maximumMedianRegressionPercent: 5,
					maximumTraversalSpeedupDropPercent: 5,
				},
			})
		);
		writeFileSync(
			relaxedPolicyPath,
			JSON.stringify({
				tolerances: {
					maximumMedianRegressionPercent: 100,
					maximumTraversalSpeedupDropPercent: 100,
				},
			})
		);

		const targetPolicyResult = runNodeScript(
			benchmarkCheckScript,
			[baselineReportPath, currentReportPath, targetPolicyPath],
			repositoryRoot
		);
		const relaxedPolicyResult = runNodeScript(
			benchmarkCheckScript,
			[baselineReportPath, currentReportPath, relaxedPolicyPath],
			repositoryRoot
		);

		expect(targetPolicyResult.status).toBe(1);
		expect(targetPolicyResult.stderr).toContain("Benchmark regression detected");
		expect(relaxedPolicyResult.status).toBe(0);
	});
});
