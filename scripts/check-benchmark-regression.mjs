import { readFile } from "node:fs/promises";
import process from "node:process";

const [baselinePath = "benchmarks/baseline.json", currentPath = "benchmarks/latest-report.json"] =
	process.argv.slice(2);
const acceptedBaseline = JSON.parse(await readFile("benchmarks/baseline.json", "utf8"));
const baselineDocument = JSON.parse(await readFile(baselinePath, "utf8"));
const baseline = baselineDocument.metrics ?? baselineDocument;
const current = JSON.parse(await readFile(currentPath, "utf8"));
const tolerances = baselineDocument.tolerances ?? acceptedBaseline.tolerances;
const maximumDurationMultiplier =
	1 + tolerances.maximumMedianRegressionPercent / 100;
const minimumSpeedupMultiplier =
	1 - tolerances.maximumTraversalSpeedupDropPercent / 100;

const durationMetrics = [
	"traversalMedianMs",
	"xmlMedianMs",
	"llmMedianMs",
	"printMedianMs",
	"tagColdMedianMs",
];
const failures = [];

for (const metric of durationMetrics) {
	const allowedMaximum = baseline[metric] * maximumDurationMultiplier;
	if (current[metric] > allowedMaximum) {
		failures.push(
			`${metric}: ${current[metric]} ms exceeds the ${allowedMaximum.toFixed(2)} ms limit`
		);
	}
}

const minimumTraversalSpeedup = baseline.estimatedTraversalSpeedup * minimumSpeedupMultiplier;
if (current.estimatedTraversalSpeedup < minimumTraversalSpeedup) {
	failures.push(
		`estimatedTraversalSpeedup: ${current.estimatedTraversalSpeedup}x is below the ${minimumTraversalSpeedup.toFixed(2)}x limit`
	);
}

if (failures.length > 0) {
	process.stderr.write(`Benchmark regression detected:\n- ${failures.join("\n- ")}\n`);
	process.exitCode = 1;
} else {
	const baselineLabel =
		baselineDocument.commit && baselineDocument.capturedAt
			? `${baselineDocument.commit} (${baselineDocument.capturedAt})`
			: baselinePath;
	process.stdout.write(`Benchmark check passed against ${baselineLabel}.\n`);
}
