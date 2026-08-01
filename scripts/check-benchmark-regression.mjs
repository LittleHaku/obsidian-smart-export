import { readFile } from "node:fs/promises";
import process from "node:process";

const baseline = JSON.parse(await readFile("benchmarks/baseline.json", "utf8"));
const current = JSON.parse(await readFile("benchmarks/latest-report.json", "utf8"));
const maximumDurationMultiplier =
	1 + baseline.tolerances.maximumMedianRegressionPercent / 100;
const minimumSpeedupMultiplier =
	1 - baseline.tolerances.maximumTraversalSpeedupDropPercent / 100;

const durationMetrics = [
	"traversalMedianMs",
	"xmlMedianMs",
	"llmMedianMs",
	"printMedianMs",
	"tagColdMedianMs",
];
const failures = [];

for (const metric of durationMetrics) {
	const allowedMaximum = baseline.metrics[metric] * maximumDurationMultiplier;
	if (current[metric] > allowedMaximum) {
		failures.push(
			`${metric}: ${current[metric]} ms exceeds the ${allowedMaximum.toFixed(2)} ms limit`
		);
	}
}

const minimumTraversalSpeedup =
	baseline.metrics.estimatedTraversalSpeedup * minimumSpeedupMultiplier;
if (current.estimatedTraversalSpeedup < minimumTraversalSpeedup) {
	failures.push(
		`estimatedTraversalSpeedup: ${current.estimatedTraversalSpeedup}x is below the ${minimumTraversalSpeedup.toFixed(2)}x limit`
	);
}

if (failures.length > 0) {
	process.stderr.write(`Benchmark regression detected:\n- ${failures.join("\n- ")}\n`);
	process.exitCode = 1;
} else {
	process.stdout.write(
		`Benchmark check passed against ${baseline.commit} (${baseline.capturedAt}).\n`
	);
}
