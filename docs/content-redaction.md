# Content Redaction

Updated: April 29, 2026

## Overview

Smart Export can replace marked private sections and regex-matched text in exported note content without editing the source notes.

Delimiter redaction is opt-in. Enable **Settings -> Smart Export -> Content redaction -> Redact marked sections** before marked sections are changed in exports.

Regex redaction rules are applied whenever one or more rules are configured, even if delimiter redaction is disabled.

## Marker model

The redaction delimiter is an exact text marker used for both the start and end of a private section.

Default settings:

- Delimiter: `:::`
- Replacement: `REDACTED`

Example source note:

```markdown
Public context. :::private thing::: More public context.
```

Exported content:

```markdown
Public context. REDACTED More public context.
```

The delimiter and replacement text are configurable. For example, if the delimiter is `<<private>>`, then `<<private>>secret<<private>>` is replaced by the configured replacement.

## Regex rules

Regex redaction rules are JavaScript regular expressions, one per line. Matches are replaced with the configured replacement text.

Examples:

```text
\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b
https?:\/\/\S+
^\s*private:.*$
```

The first two examples redact email addresses and URLs. The final example redacts a full YAML/frontmatter line named `private` when used with multiline matching.

Rules can also use slash-delimited JavaScript regex syntax with flags:

```text
/\bsecret\b/i
```

Invalid regex rules are ignored so one bad rule does not break an export.

## Rules

- Redaction applies only to included note content in the final export output.
- Redaction does not affect traversal, note selection, metadata, note titles, or source files.
- Matching delimiters can span multiple lines.
- Multiple marked sections in the same note are redacted independently.
- An unmatched delimiter is left unchanged so accidental partial markers do not remove the rest of a note.
- Regex rules are newline-separated because many valid regular expressions contain commas.
- Redaction is applied consistently to XML, Markdown template, and print-friendly Markdown exports.

## Where this is used in code

- Settings: `src/main.ts`
- Export output dispatch: `src/engine/exportOutput.ts`
- Redaction utility: `src/utils/contentRedaction.ts`
- Utility tests: `tests/utils/contentRedaction.test.ts`
- Export integration tests: `tests/engine/exportOutput.test.ts`
