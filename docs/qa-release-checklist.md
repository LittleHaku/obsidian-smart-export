# Release QA checklist

Updated: August 1, 2026

Use this checklist for every release candidate. Store the completed evidence as
`docs/qa-results/<version>-rc.<number>.md`, starting from the
[release evidence template](qa-results/template.md). Evidence is committed with the release
candidate or linked from its pull request before a stable tag is created.

## Release gate

A release candidate is ready only when:

- all automated checks pass on Windows and Linux;
- every applicable manual scenario below passes on Windows, Linux, one real Android device, and
  one real iPhone or iPad;
- desktop pop-out-window scenarios pass on Windows and Linux;
- startup measurements and `pnpm benchmark:check` are recorded;
- no unexplained material regression remains.

Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` in evidence. `FAIL`, `BLOCKED`, and required `NOT RUN`
results block a stable release. Do not substitute desktop mobile emulation for the required real
Android and iOS/iPadOS runs.

## Candidate and environment

Record the following before testing:

- release candidate version and exact commit;
- production build (`pnpm build`), not a development bundle;
- Obsidian version and installer channel;
- operating-system version, device model, and architecture;
- vault fixture name and approximate note count;
- enabled community plugins other than Smart Export;
- tester and date.

Use a disposable vault containing linked notes, backlinks, inline and frontmatter tags, excluded
folders, excluded properties, custom templates, missing links, and enough notes to exercise both
content and title depth. Never commit private vault content.

## Automated validation

Run from a fresh dependency install on both Windows PowerShell and a native Linux filesystem:

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions executes the same formatting, linting, type checking, and test commands on
`windows-latest` and `ubuntu-latest`. Record the workflow URL and the local command results. Keep
separate `node_modules` installations when using Windows and WSL/Linux.

The lifecycle test in `tests/main.test.ts` must continue to prove that `onload()` performs no
vault-wide file enumeration, metadata scan, cached note read, or export traversal. The vault
`create` listener must remain inside `workspace.onLayoutReady(...)`.

## Manual smoke-test matrix

Run each applicable scenario on Windows, Linux, Android, and iOS/iPadOS. Run `POP-01` and `POP-02`
only on desktop platforms that support pop-out windows.

| ID       | Scenario                                           | Expected result                                                                  |
| -------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| LOAD-01  | Enable/reload plugin                               | Plugin loads without console errors, startup scan, or unsolicited notice.        |
| SET-01   | Open and search settings                           | All controls render, search, persist, and restore after reload.                  |
| SET-02   | Load settings saved by the previous stable version | Values migrate without reset, corruption, or layout overflow.                    |
| SRC-01   | Select a root note                                 | Tree preview reflects content/title depth and linked notes.                      |
| SRC-02   | Select a tag source                                | Matching inline/frontmatter-tag notes appear in stable path order.               |
| SRC-03   | Add a single note, new root, and extra tag         | Additions are composed once and duplicate notes are deduplicated.                |
| LINK-01  | Export outgoing links                              | Only configured outgoing traversal is included.                                  |
| LINK-02  | Export backlinks                                   | Incoming traversal is included without missing or duplicate nodes.               |
| LINK-03  | Export both directions                             | Incoming and outgoing traversal are combined correctly.                          |
| EXCL-01  | Apply folder, tag, and property exclusions         | Matching notes are absent and are not traversed further.                         |
| PICK-01  | Use note, tag, folder, and template selectors      | Suggestions open, filter, select, and close without stale state.                 |
| OUT-01   | XML to clipboard                                   | Valid XML is copied and the success notice is shown.                             |
| OUT-02   | LLM-ready Markdown to clipboard                    | Templated Markdown is copied with expected metadata and rewritten links.         |
| OUT-03   | Print-friendly Markdown to clipboard               | TOC, numbering, headings, dividers, and page-break options behave as configured. |
| OUT-04   | Custom Markdown template                           | Selected placeholders resolve; missing template falls back safely.               |
| NOTE-01  | Export each format to a new note                   | Unique note is created in the selected folder and opens only when configured.    |
| REDACT-1 | Export marked-section and regex redaction          | Export is redacted without modifying source notes.                               |
| CANCEL-1 | Cancel destination picker and close during preview | No note/output is created and no stale async result updates the closed modal.    |
| NOTICE-1 | Trigger missing link, unavailable clipboard, error | Notices are readable, actionable, and do not repeat unexpectedly.                |
| REL-01   | Upgrade from previous version                      | Release notes appear once and the seen state persists after closing.             |
| POP-01   | Run selectors and clipboard export in pop-out      | Controls use the owning window/document and export succeeds.                     |
| POP-02   | Close release notes in pop-out                     | Focus and close behavior stay in the owning window without errors.               |

Also repeat `SET-01`, `SRC-02`, `PICK-01`, and `NOTE-01` in phone and tablet layouts when both are
available. Record screenshots only when they help explain a failure; redact vault names and note
content before attaching them.

## Startup/load-time measurement

Follow Obsidian's startup profiler procedure documented in
[Startup process](startup-process.md#startup-validation). Use the production bundle and the same
vault/profile as the previous accepted baseline.

Record five cold launches per desktop platform and report the median Smart Export load time. A
candidate is a material startup regression when its median is both more than 25% and more than
5 ms slower than the previous accepted median. Confirm that no vault-wide work appears during
startup. A material regression blocks release unless the evidence identifies the cause, user
impact, owner, and follow-up issue.

## Large-vault benchmark

Run:

```bash
pnpm benchmark:check
```

The suite creates synthetic 1,365-note traversal and 10,000-note tag fixtures; it never reads a
private vault. It compares the new medians with `benchmarks/baseline.json`. Duration medians may
increase by at most 25%, and estimated traversal speedup may drop by at most 20%. A failed check
blocks release unless the completed evidence documents the environment-sensitive exception and a
follow-up issue.

## Release decision

The completed evidence must link the candidate PR/workflow, list every exception, and end with one
decision: `GO` or `NO-GO`. The release checklist in [Maintenance plan](maintenance.md#release-readiness)
links here so a stable tag cannot be prepared without reviewing the evidence.

## References

- [Obsidian load-time guide](https://docs.obsidian.md/plugins/guides/load-time)
- [Performance benchmark methodology](../benchmarks/README.md)
- [Startup process](startup-process.md)
- [Testing and coverage](testing.md)
