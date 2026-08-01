# Performance benchmarks

Run the synthetic performance suite and enforce the accepted regression tolerances from the
repository root:

```bash
pnpm benchmark:check
```

`pnpm benchmark` remains available when a report is needed without enforcing the gate. Both
commands measure traversal/export throughput and tag discovery on synthetic large-vault fixtures:

- a deterministic 1,365-note, five-level graph with 85 simulated content reads;
- 10,000 tagged notes distributed across 100 nested tag groups plus a shared tag.

No private vault data is read or stored. The suite writes the latest machine-readable result to
the ignored `benchmarks/latest-report.json` file. `benchmark:check` compares it with the committed
`benchmarks/baseline.json` file.

## Recorded baseline

Captured on July 31, 2026 from commit `0389579` using Windows build 26200, AMD64,
Node.js 24.14.1, and pnpm 11.18.0. Timings are machine-dependent and should be used as
an indicative baseline rather than a universal threshold.

| Scenario                       |                       Fixture |  Runs |    Median |
| ------------------------------ | ----------------------------: | ----: | --------: |
| BFS traversal                  | 1,365 notes; 85 content reads |     5 |  58.34 ms |
| XML export                     |                   1,365 notes |    30 |   0.86 ms |
| LLM Markdown export            |                   1,365 notes |    30 |   1.87 ms |
| Print-friendly Markdown export |                   1,365 notes |    30 |   3.06 ms |
| Tag discovery, cold cache      |        10,000 notes; 101 tags |     5 |  11.81 ms |
| Tag discovery, warm cache      |        10,000 notes; 101 tags | 1,000 | 0.0002 ms |

The traversal fixture estimates 425 ms of serial read cost, corresponding to a 7.29x
speedup in this run. The tag benchmark invalidates the cache before every cold run and
reuses the same result for every warm run.

## Regression tolerances

The release gate allows traversal/export/tag-discovery duration medians to increase by at most
25%. Estimated traversal speedup may drop by at most 20%. The warm-cache tag timing is reported but
is not gated because sub-microsecond timer noise makes ratios misleading.

GitHub Actions checks out the target branch and candidate commit side by side, benchmarks both on
the same Windows runner, and compares their reports with the accepted tolerances. Contributors do
not need to reproduce the baseline environment or record results manually. A failure blocks the
aggregate `Test & Lint` check and must be explained and corrected in the pull request.

Promote a new baseline only for an intentional, reviewed fixture or environment change. Record the
capture date, commit, operating system, architecture, Node.js, and pnpm versions in
`benchmarks/baseline.json`; never replace the baseline merely to make a regression pass.
