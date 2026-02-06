/* eslint-disable import/no-nodejs-modules */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { App, LinkCache, TFile } from "obsidian";
import { BFSTraversal } from "../src/engine/BFSTraversal";
import { LlmMarkdownExporter } from "../src/engine/LlmMarkdownExporter";
import { PrintFriendlyMarkdownExporter } from "../src/engine/PrintFriendlyMarkdownExporter";
import { XMLExporter } from "../src/engine/XMLExporter";
import { ObsidianAPI } from "../src/obsidian-api";
import { ExportNode } from "../src/types";

interface GraphFixture {
	app: App;
	rootPath: string;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMockTFile(path: string, basename: string, vault: unknown): TFile {
	const file = new TFile();
	Object.assign(file, {
		path,
		name: `${basename}.md`,
		basename,
		extension: "md",
		vault,
		stat: {
			ctime: Date.now(),
			mtime: Date.now(),
			size: 1024,
		},
		parent: null,
	});
	return file;
}

function createSyntheticGraphFixture(
	branchingFactor: number,
	maxDepth: number,
	contentSize: number,
	readDelayMs: number
): GraphFixture {
	const filesByPath: Record<string, TFile> = {};
	const filesByBasename: Record<string, TFile> = {};
	const contentByPath: Record<string, string> = {};
	const linksByPath: Record<string, LinkCache[]> = {};
	const vault = {};
	let nextId = 0;
	const rootPath = "node-0.md";
	const rootBasename = "node-0";
	const rootFile = createMockTFile(rootPath, rootBasename, vault);
	filesByPath[rootPath] = rootFile;
	filesByBasename[rootBasename] = rootFile;
	contentByPath[rootPath] = `${rootBasename}\n${"x".repeat(contentSize)}`;
	linksByPath[rootPath] = [];

	const queue: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];
	let head = 0;

	while (head < queue.length) {
		const { path, depth } = queue[head++];
		if (depth >= maxDepth) {
			continue;
		}

		for (let i = 0; i < branchingFactor; i++) {
			nextId += 1;
			const childBasename = `node-${nextId}`;
			const childPath = `${childBasename}.md`;
			const childFile = createMockTFile(childPath, childBasename, vault);
			filesByPath[childPath] = childFile;
			filesByBasename[childBasename] = childFile;
			contentByPath[childPath] = `${childBasename}\n${"x".repeat(contentSize)}`;
			linksByPath[childPath] = [];
			linksByPath[path].push({
				link: childBasename,
				original: `[[${childBasename}]]`,
				position: {
					start: { line: 0, col: 0, offset: 0 },
					end: { line: 0, col: 0, offset: 0 },
				},
			});
			queue.push({ path: childPath, depth: depth + 1 });
		}
	}

	const app = {
		vault: {
			getFileByPath: (path: string) => filesByPath[path] ?? null,
			cachedRead: async (file: TFile) => {
				await sleep(readDelayMs);
				return contentByPath[file.path] ?? "";
			},
		},
		metadataCache: {
			getCache: (path: string) => ({
				links: linksByPath[path] ?? [],
				frontmatterLinks: [],
			}),
			getFirstLinkpathDest: (link: string) => filesByBasename[link] ?? null,
			resolvedLinks: {},
		},
	} as unknown as App;

	return { app, rootPath };
}

function countNodes(root: ExportNode): { total: number; withContent: number } {
	const queue: ExportNode[] = [root];
	let head = 0;
	let total = 0;
	let withContent = 0;

	while (head < queue.length) {
		const node = queue[head++];
		total += 1;
		if (node.includeContent) {
			withContent += 1;
		}
		for (const child of node.children) {
			queue.push(child);
		}
	}

	return { total, withContent };
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

async function measureAsyncRuns(runs: number, task: () => Promise<void>): Promise<number[]> {
	const durations: number[] = [];
	for (let i = 0; i < runs; i++) {
		const start = performance.now();
		await task();
		durations.push(performance.now() - start);
	}
	return durations;
}

function measureSyncRuns(runs: number, task: () => void): number[] {
	const durations: number[] = [];
	for (let i = 0; i < runs; i++) {
		const start = performance.now();
		task();
		durations.push(performance.now() - start);
	}
	return durations;
}

describe("Performance benchmarks", () => {
	it("benchmarks traversal and exporter throughput on a 1k+ note synthetic graph", async () => {
		const branchingFactor = 4;
		const traversalDepth = 5;
		const contentDepth = 3;
		const perReadDelayMs = 5;
		const traversalRuns = 5;
		const exporterRuns = 30;
		const fixture = createSyntheticGraphFixture(
			branchingFactor,
			traversalDepth,
			400,
			perReadDelayMs
		);
		const obsidianAPI = new ObsidianAPI(fixture.app);
		let lastTree: ExportNode | null = null;
		const traversalDurations = await measureAsyncRuns(traversalRuns, async () => {
			const traversal = new BFSTraversal(obsidianAPI, contentDepth, traversalDepth, "outgoing");
			lastTree = await traversal.traverse(fixture.rootPath);
		});

		expect(lastTree).not.toBeNull();
		const rootTree = lastTree as ExportNode;
		const nodeCounts = countNodes(rootTree);
		const traversalMedian = median(traversalDurations);
		const expectedSerialReadCostMs = nodeCounts.withContent * perReadDelayMs;
		const estimatedSpeedup = expectedSerialReadCostMs / traversalMedian;

		const xmlExporter = new XMLExporter();
		const llmExporter = new LlmMarkdownExporter();
		const printExporter = new PrintFriendlyMarkdownExporter();

		let xmlLength = 0;
		let llmLength = 0;
		let printLength = 0;
		const xmlDurations = measureSyncRuns(exporterRuns, () => {
			xmlLength = xmlExporter.export(rootTree, "benchmark-vault", 0).length;
		});
		const llmDurations = measureSyncRuns(exporterRuns, () => {
			llmLength = llmExporter.export(rootTree, "benchmark-vault", 0).length;
		});
		const printDurations = measureSyncRuns(exporterRuns, () => {
			printLength = printExporter.export(rootTree).length;
		});

		const reportLines = [
			"Smart Export benchmark (synthetic graph)",
			`- Nodes traversed: ${nodeCounts.total.toLocaleString()}`,
			`- Nodes with content reads: ${nodeCounts.withContent.toLocaleString()}`,
			`- BFS traversal median (${traversalRuns} runs): ${traversalMedian.toFixed(2)} ms`,
			`- Estimated serial read cost: ${expectedSerialReadCostMs.toFixed(2)} ms`,
			`- Estimated traversal speedup vs serial reads: ${estimatedSpeedup.toFixed(2)}x`,
			`- XML export median (${exporterRuns} runs): ${median(xmlDurations).toFixed(2)} ms (len ${xmlLength.toLocaleString()})`,
			`- LLM Markdown export median (${exporterRuns} runs): ${median(llmDurations).toFixed(2)} ms (len ${llmLength.toLocaleString()})`,
			`- Print-friendly export median (${exporterRuns} runs): ${median(printDurations).toFixed(2)} ms (len ${printLength.toLocaleString()})`,
		];
		writeFileSync(
			"benchmarks/latest-report.json",
			`${JSON.stringify(
				{
					nodesTraversed: nodeCounts.total,
					nodesWithContentReads: nodeCounts.withContent,
					traversalRuns,
					traversalMedianMs: Number(traversalMedian.toFixed(2)),
					estimatedSerialReadCostMs: Number(expectedSerialReadCostMs.toFixed(2)),
					estimatedTraversalSpeedup: Number(estimatedSpeedup.toFixed(2)),
					exporterRuns,
					xmlMedianMs: Number(median(xmlDurations).toFixed(2)),
					xmlLength,
					llmMedianMs: Number(median(llmDurations).toFixed(2)),
					llmLength,
					printMedianMs: Number(median(printDurations).toFixed(2)),
					printLength,
				},
				null,
				2
			)}\n`
		);
		process.stdout.write(`${reportLines.join("\n")}\n`);
	}, 30_000);
});
