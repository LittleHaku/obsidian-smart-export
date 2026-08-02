import { builtinModules } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repositoryRoot = process.cwd();
const sourceRoot = path.join(repositoryRoot, "src");
const manifestPath = path.join(repositoryRoot, "manifest.json");
const blockedModules = new Set([
	"electron",
	...builtinModules,
	...builtinModules.map((moduleName) => `node:${moduleName}`),
]);
const lookbehindMarkers = [
	["(", "?", "<", "="].join(""),
	["(", "?", "<", "!"].join(""),
];
const violations = [];

function containsLookbehind(pattern) {
	return lookbehindMarkers.some((marker) => pattern.includes(marker));
}

function getStaticPattern(node) {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

async function findSourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const nestedFiles = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				return findSourceFiles(entryPath);
			}
			return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
		})
	);
	return nestedFiles.flat();
}

function report(sourceFile, node, message) {
	const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
	const relativePath = path.relative(repositoryRoot, sourceFile.fileName).replaceAll("\\", "/");
	violations.push(`${relativePath}:${position.line + 1}:${position.character + 1} ${message}`);
}

function checkModuleSpecifier(sourceFile, node, moduleName) {
	if (blockedModules.has(moduleName) || moduleName.startsWith("electron/")) {
		report(sourceFile, node, `imports desktop-only module "${moduleName}"`);
	}
}

function inspectSourceFile(filePath, sourceText) {
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	);

	function visit(node) {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			checkModuleSpecifier(sourceFile, node.moduleSpecifier, node.moduleSpecifier.text);
		}

		if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			node.moduleReference.expression &&
			ts.isStringLiteral(node.moduleReference.expression)
		) {
			checkModuleSpecifier(
				sourceFile,
				node.moduleReference.expression,
				node.moduleReference.expression.text
			);
		}

		if (
			ts.isCallExpression(node) &&
			node.arguments.length === 1 &&
			ts.isStringLiteral(node.arguments[0]) &&
			((ts.isIdentifier(node.expression) && node.expression.text === "require") ||
				node.expression.kind === ts.SyntaxKind.ImportKeyword)
		) {
			checkModuleSpecifier(sourceFile, node.arguments[0], node.arguments[0].text);
		}

		if (
			((ts.isPropertyAccessExpression(node) && node.name.text === "platform") ||
				(ts.isElementAccessExpression(node) &&
					node.argumentExpression &&
					ts.isStringLiteral(node.argumentExpression) &&
					node.argumentExpression.text === "platform")) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "process"
		) {
			report(sourceFile, node, "uses process.platform instead of Obsidian Platform helpers");
		}

		if (ts.isRegularExpressionLiteral(node) && containsLookbehind(node.text)) {
			report(sourceFile, node, "uses regular-expression lookbehind without a mobile fallback");
		}

		if (
			(ts.isCallExpression(node) || ts.isNewExpression(node)) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "RegExp" &&
			node.arguments?.[0]
		) {
			const pattern = getStaticPattern(node.arguments[0]);
			if (pattern !== null && containsLookbehind(pattern)) {
				report(
					sourceFile,
					node.arguments[0],
					"uses regular-expression lookbehind without a mobile fallback"
				);
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.isDesktopOnly !== false) {
	violations.push('manifest.json must declare "isDesktopOnly": false');
}

for (const sourceFile of await findSourceFiles(sourceRoot)) {
	inspectSourceFile(sourceFile, await readFile(sourceFile, "utf8"));
}

if (violations.length > 0) {
	process.stderr.write(`Mobile compatibility check failed:\n- ${violations.join("\n- ")}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		"Mobile compatibility check passed: manifest and runtime source are platform-safe.\n"
	);
}
