# Codex Cloud and coding agent setup

Updated: August 1, 2026

## Repository-provided context

A normal clone contains the project guidance needed by Codex and other contributors:

- `AGENTS.md` defines repository conventions, commands, release policy, and validation order.
- `.agents/skills/obsidian-plugin-dev/SKILL.md` provides the reusable Obsidian development workflow.
- `.agents/skills/obsidian-plugin-dev/reference/` contains the API, lifecycle, UI, policy, and release checklists used by that skill.
- `docs/` contains the source-of-truth behavior and maintenance documentation.

Codex reads the root `AGENTS.md` before starting repository work and discovers repository
skills under `.agents/skills`. Keep these files committed, repository-relative, and free of
credentials or machine-specific paths.

## Recommended Codex Cloud environment

Codex Cloud checks out the selected branch into a hosted container. Configure the repository
environment in Codex settings with these values:

- Runtime: Node.js 24, matching `.nvmrc`.
- Package manager: the Corepack-managed pnpm version declared in `package.json`.
- Setup script:

  ```bash
  corepack enable pnpm
  pnpm install --frozen-lockfile
  ```

- Optional maintenance script for resumed cached environments:

  ```bash
  pnpm install --frozen-lockfile
  ```

Normal formatting, linting, testing, benchmarking, and production builds do not require
secrets or agent-phase internet access. GitHub operations still depend on the Cloud task or
connector permissions granted by the user or workspace.

## Verify a Cloud or fresh-clone environment

From the repository root, run:

```bash
node --version
pnpm --version
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected runtime versions are Node.js 24 and pnpm 11. The repository also supports the wider
ranges declared in `package.json`, but CI and `.nvmrc` use Node.js 24.

To verify Codex instruction discovery, ask it to list the repository instruction files and
skills it loaded. The response should include `AGENTS.md` and `obsidian-plugin-dev`.

## What a clone does not include

Git cannot carry personal or authenticated state. A fresh clone or Codex Cloud environment
does not automatically inherit:

- personal guidance from a user's Codex home directory;
- globally installed skills or plugins;
- GitHub, Gmail, Calendar, or other connector authorization;
- local environment variables and secrets;
- an Obsidian runtime for optional exploratory or bug-reproduction testing.

Configure those capabilities separately when a task requires them. Repository work must still
be possible with the checked-in guidance and the standard pnpm toolchain alone.

## Official Codex references

- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Build skills](https://learn.chatgpt.com/docs/build-skills)
