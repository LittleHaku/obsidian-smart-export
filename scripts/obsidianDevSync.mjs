import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const LOCAL_ENV_FILE = ".env.local";
const STATIC_ASSET_FILES = ["manifest.json", "styles.css"];

/**
 * Loads a local-only Obsidian plugin directory from process env or `.env.local`.
 * Values already present in process.env take precedence over the file.
 */
export function loadObsidianPluginDir(projectRoot) {
	loadLocalEnvFile(projectRoot);
	const pluginDir = process.env.OBSIDIAN_PLUGIN_DIR?.trim();
	return pluginDir && pluginDir.length > 0 ? pluginDir : null;
}

export function syncStaticAssets(projectRoot, pluginDir) {
	for (const assetFile of STATIC_ASSET_FILES) {
		syncFileIfPresent(projectRoot, pluginDir, assetFile);
	}
}

export function syncBuiltMainJs(projectRoot, pluginDir) {
	syncFileIfPresent(projectRoot, pluginDir, "main.js");
}

export function watchStaticAssets(projectRoot, pluginDir) {
	const watchers = [];

	for (const assetFile of STATIC_ASSET_FILES) {
		const sourcePath = path.join(projectRoot, assetFile);
		if (!fs.existsSync(sourcePath)) {
			continue;
		}

		const watcher = fs.watch(sourcePath, () => {
			syncFileIfPresent(projectRoot, pluginDir, assetFile);
		});
		watchers.push(watcher);
	}

	return () => {
		for (const watcher of watchers) {
			watcher.close();
		}
	};
}

function loadLocalEnvFile(projectRoot) {
	const envFilePath = path.join(projectRoot, LOCAL_ENV_FILE);
	if (!fs.existsSync(envFilePath)) {
		return;
	}

	const envFile = fs.readFileSync(envFilePath, "utf8");
	for (const line of envFile.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
			continue;
		}

		const equalsIndex = trimmedLine.indexOf("=");
		if (equalsIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, equalsIndex).trim();
		if (key.length === 0 || Object.hasOwn(process.env, key)) {
			continue;
		}

		let value = trimmedLine.slice(equalsIndex + 1).trim();
		if (
			value.length >= 2 &&
			((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'")))
		) {
			value = value.slice(1, -1);
		}

		process.env[key] = value;
	}
}

function syncFileIfPresent(projectRoot, pluginDir, relativeFilePath) {
	const sourcePath = path.resolve(projectRoot, relativeFilePath);
	if (!fs.existsSync(sourcePath)) {
		return;
	}

	const targetPath = path.resolve(pluginDir, relativeFilePath);
	if (sourcePath === targetPath) {
		return;
	}

	fs.mkdirSync(path.dirname(targetPath), { recursive: true });
	fs.copyFileSync(sourcePath, targetPath);
}
