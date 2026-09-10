# Generalized Laboratory Model

Agent Laboratory's scientific phases map to a domain-neutral workflow:

| Original function | Agentic R&D function |
| --- | --- |
| Literature review | Evidence and context review |
| Plan formulation | Evidence-dependent plan |
| Data preparation | Resource preparation inside the plan/execution boundary |
| Experiments | Bounded execution or investigation |
| Results interpretation | Results analysis |
| Report writing | Reviewed final synthesis |

Preserve the original pattern's useful properties: the human remains the pilot, specialists own narrow work, phases have checkpoints, failures remain visible, and results are reviewed before synthesis.

Modernize the mechanism rather than copying the original runtime: use the coding agent's native tools and subagents, portable Markdown artifacts, provider-neutral instructions, explicit authorization boundaries, and a small deterministic state validator instead of hardcoded model backends or serialized Python agent objects.

## What The Validator Can And Cannot Establish

The CLI enforces workflow order, minimum artifact contracts, finding coverage, stage-gate thresholds, revision continuity, managed-path safety, and explicit completion state. Those checks make an audit trail more consistent; they do not prove that a claim is true, a source is authoritative, an analysis is unbiased, or a reviewer is independent.

Human reviewers and domain-qualified experts remain the decision authority wherever the brief, sensitivity, or review policy requires them. Automated state can record that a checkpoint was requested or completed, but the decision evidence belongs in the run log and the relevant review artifact.

The current state machine assumes one writer. Specialists may work concurrently in disjoint Markdown files, but only the orchestrator should mutate `run-state.json` and `work/00-run-log.md`. Do not run concurrent CLI state transitions in the same workspace.
