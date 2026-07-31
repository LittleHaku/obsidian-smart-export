# Performance benchmarks

Run the synthetic performance suite from the repository root:

```bash
pnpm benchmark
```

The command measures traversal/export throughput and tag discovery on a synthetic large vault.
It writes the most recent machine-readable result to the ignored
`benchmarks/latest-report.json` file so local runs do not create working-tree changes.

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
