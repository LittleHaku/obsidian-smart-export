// @vitest-environment node
/// <reference types="node" />

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const mobileCheckScript = path.join(repositoryRoot, "scripts", "check-mobile-compat.mjs");
const benchmarkCheckScript = path.join(repositoryRoot, "scripts", "check-benchmark-regression.mjs");
const releaseValidationScript = path.join(repositoryRoot, "scripts", "validate-release.mjs");
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

function runGit(args: string[], cwd: string) {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createReleaseRepository() {
	const fixtureRoot = createTemporaryDirectory();
	runGit(["init", "-b", "main"], fixtureRoot);
	runGit(["config", "user.email", "tests@example.com"], fixtureRoot);
	runGit(["config", "user.name", "Release tests"], fixtureRoot);
	writeFileSync(
		path.join(fixtureRoot, "package.json"),
		`${JSON.stringify({ version: "1.2.3" })}\n`
	);
	writeFileSync(
		path.join(fixtureRoot, "manifest.json"),
		`${JSON.stringify({ version: "1.2.3", minAppVersion: "1.13.0" })}\n`
	);
	writeFileSync(
		path.join(fixtureRoot, "versions.json"),
		`${JSON.stringify({ "1.2.3": "1.13.0" })}\n`
	);
	mkdirSync(path.join(fixtureRoot, "release-assets"));
	writeFileSync(path.join(fixtureRoot, "release-assets", "main.js"), "production bundle\n");
	writeFileSync(path.join(fixtureRoot, "release-assets", "manifest.json"), "release manifest\n");
	writeFileSync(path.join(fixtureRoot, "release-assets", "styles.css"), "release styles\n");
	runGit(["add", "."], fixtureRoot);
	runGit(["commit", "-m", "fixture"], fixtureRoot);
	return fixtureRoot;
}

function runReleaseValidation(args: string[], cwd: string) {
	return runNodeScript(releaseValidationScript, args, cwd);
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
	it("accepts a stable tag reachable from main and validates release assets", () => {
		const fixtureRoot = createReleaseRepository();
		const sha = runGit(["rev-parse", "HEAD"], fixtureRoot);

		const result = runReleaseValidation(
			[
				"--tag",
				"1.2.3",
				"--sha",
				sha,
				"--main-ref",
				"main",
				"--assets-dir",
				path.join(fixtureRoot, "release-assets"),
			],
			fixtureRoot
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Release validation passed");
	});

	it("rejects a stable tag commit that is not reachable from main", () => {
		const fixtureRoot = createReleaseRepository();
		runGit(["switch", "-c", "feature"], fixtureRoot);
		writeFileSync(path.join(fixtureRoot, "feature.txt"), "feature\n");
		runGit(["add", "feature.txt"], fixtureRoot);
		runGit(["commit", "-m", "feature"], fixtureRoot);
		const sha = runGit(["rev-parse", "HEAD"], fixtureRoot);

		const result = runReleaseValidation(
			["--tag", "1.2.3", "--sha", sha, "--main-ref", "main"],
			fixtureRoot
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("not reachable from main");
	});

	it("allows prerelease tags from a branch and rejects unexpected assets", () => {
		const fixtureRoot = createReleaseRepository();
		const packageJsonPath = path.join(fixtureRoot, "package.json");
		const manifestPath = path.join(fixtureRoot, "manifest.json");
		const versionsPath = path.join(fixtureRoot, "versions.json");
		writeFileSync(packageJsonPath, `${JSON.stringify({ version: "1.2.4-beta.1" })}\n`);
		writeFileSync(
			manifestPath,
			`${JSON.stringify({ version: "1.2.4-beta.1", minAppVersion: "1.13.0" })}\n`
		);
		writeFileSync(versionsPath, `${JSON.stringify({ "1.2.4-beta.1": "1.13.0" })}\n`);

		const result = runReleaseValidation(["--tag", "1.2.4-beta.1"], fixtureRoot);
		expect(result.status).toBe(0);

		writeFileSync(path.join(fixtureRoot, "release-assets", "README.md"), "not shipped\n");
		const assetResult = runReleaseValidation(
			["--tag", "1.2.4-beta.1", "--assets-dir", path.join(fixtureRoot, "release-assets")],
			fixtureRoot
		);

		expect(assetResult.status).toBe(1);
		expect(assetResult.stderr).toContain("Unexpected release asset: README.md");
	});

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
