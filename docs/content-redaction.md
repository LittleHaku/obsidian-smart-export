# Content Redaction

Updated: April 29, 2026

## Overview

Smart Export can replace marked private sections and regular-expression-matched text in exported note content without editing the source notes.

Delimiter redaction is opt-in. Enable **Settings -> Smart Export -> Content redaction -> Redact marked sections** before marked sections are changed in exports.

Regular expression redaction is opt-in separately. Enable **Apply regular expression redaction rules** before regular expression rules are applied in exports.

## Marker model

The redaction delimiter is an exact text marker used for both the start and end of a private section.

Default settings:

- Redact marked sections: off
- Delimiter: `:::`
- Marked section replacement: `REDACTED`
- Apply regular expression redaction rules: off
- Regular expression replacement: blank
- Regular expression rules:

```text
\[\^[^\]]+\]
!\[\[[^\]]+\]\]
\]\([^\)]+\)
https?:\/\/\S+
\[\[[^\]|]+\|
\[\[|\]\]|\[|\]
```

Example source note:

```markdown
Public context. :::private thing::: More public context.
```

Exported content:

```markdown
Public context. REDACTED More public context.
```

The delimiter and replacement text are configurable. For example, if the delimiter is `<<private>>`, then `<<private>>secret<<private>>` is replaced by the configured replacement.

## Regular expression rules

Regular expression redaction rules are one per line. Matches are replaced with the configured regular expression replacement text. The default regular expression replacement is blank, so matches are removed. The default rules are examples only until **Apply regular expression redaction rules** is enabled.

Examples:

```text
\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b
https?:\/\/\S+
^\s*private:.*$
```

The first two examples redact email addresses and URLs. The final example redacts a full YAML/frontmatter line named `private` when used with multiline matching.

To remove Markdown link destinations while keeping visible labels like `[Link Label](https://obsidian.md)` as `Link Label`, use these rules together:

```text
\]\([^\)]+\)
\[\[|\]\]|\[|\]
```

Rules can also use slash-delimited regular expression syntax with flags:

```text
/\bsecret\b/i
```

Invalid regular expression rules are ignored so one bad rule does not break an export.

The settings tab includes a live preview with editable sample input and read-only redacted output. The preview uses the same delimiter settings, marked-section replacement, regular expression toggle, regular expression replacement, and regular expression rules as exports. The default sample includes regular-expression examples and a marked section such as `:::thing:::`.

## Rules

- Redaction applies only to included note content in the final export output.
- Redaction does not affect traversal, note selection, metadata, note titles, or source files.
- Matching delimiters can span multiple lines.
- Multiple marked sections in the same note are redacted independently.
- An unmatched delimiter is left unchanged so accidental partial markers do not remove the rest of a note.
- Marked sections and regular expression rules have independent toggles and replacement text.
- Regular expression rules are newline-separated because many valid regular expressions contain commas.
- Redaction is applied consistently to XML, Markdown template, and print-friendly Markdown exports.

## Where this is used in code

- Settings: `src/main.ts`
- Export output dispatch: `src/engine/exportOutput.ts`
- Redaction utility: `src/utils/contentRedaction.ts`
- Utility tests: `tests/utils/contentRedaction.test.ts`
- Export integration tests: `tests/engine/exportOutput.test.ts`
