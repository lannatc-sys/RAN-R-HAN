# Host Compatibility

The portable contract is the Agent Skills `SKILL.md` format. Discovery paths, invocation syntax, permissions, and subagent APIs remain host-specific.

| Host | Typical project path | Invocation | Verification |
| --- | --- | --- | --- |
| Codex | `.agents/skills/agentic-rd-skill/` | `$agentic-rd-skill` | Discovery/activation smoke passed on Codex CLI 0.144.6 in the dated snapshot below. |
| Claude Code | `.claude/skills/agentic-rd-skill/` | `/agentic-rd-skill` | Discovery/activation smoke passed on Claude Code 2.1.214 in the dated snapshot below; host permissions remain authoritative. |
| GitHub Copilot | `.agents/skills/agentic-rd-skill/` or `.github/skills/agentic-rd-skill/` | Automatic or host skill command | Discovery/activation smoke passed on GitHub Copilot CLI 1.0.71 in the dated snapshot below. Other surfaces may expose different tools. |
| Gemini CLI | `.agents/skills/agentic-rd-skill/` or `.gemini/skills/agentic-rd-skill/` | Automatic or `/skills` | Format/path was verified from official documentation for the dated snapshot; no local binary was available for activation testing. |
| OpenCode | `.agents/skills/agentic-rd-skill/` or `.opencode/skills/agentic-rd-skill/` | Native `skill` tool | Discovery/activation smoke passed on OpenCode 1.18.3 in the dated snapshot below. |

Local smoke snapshot: 2026-07-18 on Windows with isolated temporary workspaces, read-only activation prompts, no external research, and no persistent test workspace.

This table is point-in-time evidence, not a claim that the same versions or behaviors remain current. On 2026-07-31, the deterministic host-smoke runner itself was rechecked, but no eligible GitHub Copilot or OpenCode command was installed in that environment. The runner correctly exited with code 3 and reported `inconclusive`; that result neither revalidates nor disproves the activation snapshot above.

## Requirements

- Filesystem read/write access is required for durable workflow artifacts.
- Node.js 20 or newer is required only for `scripts/rd.mjs`.
- Web access is optional; offline runs must label current external facts as unverified.
- Native subagents are optional; the `compact` profile provides a single-agent fallback.
- Host limits and approval policies always override this skill.
- The CLI state machine is single-writer even when the host supports parallel agents; concurrent specialists must own disjoint artifact files and route state transitions through the orchestrator.

## Distribution

The repository uses `skills/agentic-rd-skill/` so standard skill discovery, `npx skills add TheStreamCode/agentic-rd-skill`, and GitHub CLI publishing can identify the package. Install the skill directory, not the repository-level documentation and tests, unless the host's installer handles repository discovery. A direct Skills CLI install works before the `skills.sh` catalog page is indexed; catalog visibility and install counts depend on anonymous CLI telemetry and cache refreshes.

Do not claim a host is smoke-tested unless a real activation test was run on the named version. Format compatibility derived from vendor documentation is not the same as behavioral verification.
