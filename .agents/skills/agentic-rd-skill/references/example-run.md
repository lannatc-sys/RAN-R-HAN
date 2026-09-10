# Compact Example Run

Request: assess whether an existing notes application can add offline sync within one quarter without a new backend service.

This walkthrough uses the synthetic paths `<skill-root>` and `<workspace>`. Replace them with the installed skill directory and the target project. Real runs must cite only sources actually consulted and record only checks actually performed.

## Initialize And Establish Setup

1. Initialize a compact run with an explicit review policy:

   ```text
   node <skill-root>/scripts/rd.mjs init <workspace> --profile compact --human-review final-only
   ```

2. Fill `project-brief.md` with the React/Postgres context, one-quarter constraint, engineering-lead audience, success criteria, and prohibition on adding a backend service.
3. Fill `work/00-run-log.md` with the selected profile, assignments, authorization boundary, and initial checkpoint. Setup deliberately remains `in_progress` until these two artifacts satisfy their minimum contracts.
4. Start evidence only after setup is ready:

   ```text
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase evidence --status in_progress
   ```

   The command validates the full current state before writing and completes setup as part of the transition.

## Produce And Review The Work

1. Write `work/01-evidence/01-orchestrator.md` comparing server-authoritative last-write-wins and CRDT approaches. Assign stable IDs such as `E-01` to the observed API constraint and `E-02` to the inferred concurrency risk. Keep sources, observations, assumptions, and unknowns distinct.
2. Complete evidence, start plan, and fill `work/02-plan.md`. Its finding-coverage table must map both IDs to work or an explicit deferral.
3. Complete the plan and run bounded execution. Record architecture inspection and actual checks in `work/03-execution/01-orchestrator.md`; then interpret them in `work/04-results/01-orchestrator.md` without relabeling estimates as observations.
4. Use `artifact` when a phase needs another independently owned evidence, execution, or results file:

   ```text
   node <skill-root>/scripts/rd.mjs artifact <workspace> --phase results --name effort-review
   ```

5. Complete results and cross-review. In `work/05-cross-review.md`, flag that the effort estimate for `E-02` is unmeasured and request an explicit inference label.
6. Complete cross-review, start the stage gate, fill `work/06-stage-gate.md`, and record the decision as a revision request:

   ```text
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase stage-gate --status needs_revision --score 7 --dimensions 2,1,1,1,2 --blockers 0 --reason "Label the E-02 effort estimate as an inference"
   ```

7. Record the revision assignment in the run log, reopen the earliest affected upstream phase, revise the owned artifact, rerun the dependent review, and return to the gate. The workflow retains the revision ID and upstream fingerprints:

   ```text
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase results --status in_progress
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase results --status complete
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase cross-review --status in_progress
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase cross-review --status complete
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase stage-gate --status in_progress
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase stage-gate --status approved --score 8 --dimensions 2,2,1,1,2 --blockers 0
   ```

   Approval is accepted only when the required upstream bytes changed or the revision has an explicit justified no-change disposition.

## Finalize And Verify

1. Run `finalize`, then fill `work/07-final-output.md`. The synthesis recommends last-write-wins via IndexedDB and the existing API, preserves conflict UX as a risk, and proposes a one-week spike.
2. Complete the final phase and validate the whole run:

   ```text
   node <skill-root>/scripts/rd.mjs advance <workspace> --phase final --status complete
   node <skill-root>/scripts/rd.mjs validate <workspace> --json
   ```

3. Treat the run as finished only when validation reports `valid_complete`. `valid_incomplete` means structurally valid but unfinished; `invalid` identifies a contract violation that must be repaired before further mutation.
