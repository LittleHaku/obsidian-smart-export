import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const STABLE_TAG_PATTERN = /^\d+\.\d+\.\d+$/;
const RELEASE_TAG_PATTERN = /^\d+\.\d+\.\d+(?:-(?:alpha|beta|canary)\.\d+)?$/;
const RELEASE_ASSETS = new Set(["main.js", "manifest.json", "styles.css"]);

function parseArguments(argumentsList) {
	const options = {};
	for (let index = 0; index < argumentsList.length; index += 1) {
		const argument = argumentsList[index];
		if (!argument.startsWith("--")) {
			throw new Error(`Unexpected argument: ${argument}`);
		}
		const name = argument.slice(2);
		const value = argumentsList[index + 1];
		if (!value || value.startsWith("--")) {
			throw new Error(`Missing value for --${name}`);
		}
		options[name] = value;
		index += 1;
	}
	return options;
}

function readJson(filePath) {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		throw new Error(`Could not read JSON file ${filePath}: ${error.message}`, { cause: error });
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function assertStableTagReachableFromMain({ repositoryRoot, sha, mainRef }) {
	assert(sha, "Stable release validation requires a commit SHA.");
	assert(mainRef, "Stable release validation requires a main branch ref.");
	try {
		execFileSync("git", ["merge-base", "--is-ancestor", sha, mainRef], {
			cwd: repositoryRoot,
			stdio: "ignore",
		});
	} catch {
		throw new Error(
			`Stable release commit ${sha} is not reachable from ${mainRef}. Stable tags must be created from main.`
		);
	}
}

function assertReleaseAssets(assetsDirectory) {
	assert(existsSync(assetsDirectory), `Release assets directory does not exist: ${assetsDirectory}`);
	const entries = readdirSync(assetsDirectory);
	assert(entries.includes("main.js"), "Release assets must include main.js.");
	assert(entries.includes("manifest.json"), "Release assets must include manifest.json.");
	for (const entry of entries) {
		assert(RELEASE_ASSETS.has(entry), `Unexpected release asset: ${entry}`);
		assert(statSync(path.join(assetsDirectory, entry)).isFile(), `Release asset is not a file: ${entry}`);
	}
}

function validateRelease(options) {
	const repositoryRoot = path.resolve(options["repository-root"] ?? process.cwd());
	const tag = options.tag;
	assert(tag, "Release validation requires --tag.");
	assert(RELEASE_TAG_PATTERN.test(tag), `Invalid release tag: ${tag}`);

	const packageJson = readJson(path.join(repositoryRoot, "package.json"));
	const manifest = readJson(path.join(repositoryRoot, "manifest.json"));
	const versions = readJson(path.join(repositoryRoot, "versions.json"));
	assert(packageJson.version === tag, "Tag and package.json versions must match.");
	assert(manifest.version === tag, "Tag and manifest.json versions must match.");
	assert(
		Object.prototype.hasOwnProperty.call(versions, tag),
		`versions.json must contain an entry for ${tag}.`
	);
	assert(
		versions[tag] === manifest.minAppVersion,
		`versions.json must map ${tag} to manifest.json minAppVersion.`
	);

	if (STABLE_TAG_PATTERN.test(tag)) {
		assertStableTagReachableFromMain({
			repositoryRoot,
			sha: options.sha ?? process.env.GITHUB_SHA,
			mainRef: options["main-ref"] ?? process.env.RELEASE_MAIN_REF ?? "origin/main",
		});
	}

	if (options["assets-dir"]) {
		assertReleaseAssets(path.resolve(options["assets-dir"]));
	}
}

try {
	validateRelease(parseArguments(process.argv.slice(2)));
	process.stdout.write("Release validation passed.\n");
} catch (error) {
	process.stderr.write(`Release validation failed: ${error.message}\n`);
	process.exitCode = 1;
}
