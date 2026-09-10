# Role Selection Reference

Select capabilities, not ceremonial titles. One agent may own adjacent capabilities in `compact` runs; split them when evidence bases, permissions, or evaluation standards differ.

## Core Capabilities

- Orchestrator: owns the run log, assignments, dependency gates, and user checkpoints.
- Evidence reviewer: establishes verified context and known unknowns.
- Plan owner: converts reconciled evidence into an executable or investigatory plan.
- Execution specialist: performs one bounded work package and records raw outcomes.
- Results analyst: interprets execution without rewriting inconvenient evidence.
- Risk reviewer: checks uncertainty, authorization, safety, and failure modes.
- Cross-reviewer: challenges the full package and assigns targeted revisions.
- Stage-gate reviewer: scores readiness independently of final synthesis and discloses any earlier artifact ownership.
- Final synthesizer: writes only after approval.

## Optional Domain Capabilities

- Technical feasibility and architecture.
- Product, UX, market, competitor, business model, or go-to-market.
- Scientific literature, data, or experiment design.
- Security and privacy.
- Legal or compliance analysis with qualified human review.
- Operations, rollout, and implementation planning.

## Assignment Rules

- Include a capability only when it can materially change the deliverable.
- Give every parallel specialist one disjoint output file.
- Give material findings stable IDs and retain the same IDs through plan, results, review, and final coverage tables.
- Use `rd.mjs artifact` to scaffold extra evidence, execution, or results files instead of inventing unmanaged paths.
- Do not ask a planning agent to work before evidence is available.
- Do not assign final synthesis to a specialist whose work still needs review.
- Keep a minority specialist view when it represents genuine uncertainty.
- Reduce the team when role overlap creates more coordination cost than insight.

## Review Independence

Prefer a cross-reviewer and stage-gate reviewer who did not own the artifacts they assess. When the host or compact profile cannot provide that separation, record the fallback in `work/00-run-log.md` and in the review artifact; do not describe self-review as independent review.

A reviewer may have contributed earlier evidence without becoming disqualified, but must disclose the overlap and challenge the result against the brief, sources, failed work, authorization boundary, and preserved minority views. Final synthesis remains downstream of approval and must not silently resolve open disagreements.
