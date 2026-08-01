# QA evidence VERSION-rc.N

- Candidate version:
- Commit:
- Pull request/workflow:
- Tester and date:
- Final decision: `GO` / `NO-GO`

## Environments

| Platform   | OS/device | Architecture | Obsidian | Smart Export | Vault fixture | Other plugins |
| ---------- | --------- | ------------ | -------- | ------------ | ------------- | ------------- |
| Windows    |           |              |          |              |               |               |
| Linux      |           |              |          |              |               |               |
| Android    |           |              |          |              |               |               |
| iOS/iPadOS |           |              |          |              |               |               |

## Automated checks

| Platform | Install | Format | Lint | Types | Tests | Build | Evidence link |
| -------- | ------- | ------ | ---- | ----- | ----- | ----- | ------------- |
| Windows  |         |        |      |       |       |       |               |
| Linux    |         |        |      |       |       |       |               |

## Manual smoke tests

Copy the IDs from the [release QA checklist](../qa-release-checklist.md#manual-smoke-test-matrix).

| ID  | Windows | Linux | Android | iOS/iPadOS | Notes/evidence |
| --- | ------- | ----- | ------- | ---------- | -------------- |
|     |         |       |         |            |                |

## Startup measurements

Record milliseconds from five cold launches and calculate the median.

| Platform | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | Previous median | Change |
| -------- | ----: | ----: | ----: | ----: | ----: | -----: | --------------: | -----: |
| Windows  |       |       |       |       |       |        |                 |        |
| Linux    |       |       |       |       |       |        |                 |        |

- Production bundle confirmed:
- No vault-wide startup work observed:
- Profiler screenshot/log link:

## Large-vault benchmark

- Command: `pnpm benchmark:check`
- Environment:
- Result: `PASS` / `FAIL`
- `benchmarks/latest-report.json` summary or artifact link:
- Difference from `benchmarks/baseline.json`:

## Regressions and exceptions

List each failure, blocker, accepted exception, owner, and follow-up issue. Write `None` when all
required checks pass.

## Decision

State why the candidate is `GO` or `NO-GO`, including confirmation that real Android and
iOS/iPadOS runs were completed.
