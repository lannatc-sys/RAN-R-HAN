#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXIT = Object.freeze({ SUCCESS: 0, USAGE: 2, STATE: 3, FILESYSTEM: 4 });
const PROFILE_LIMITS = Object.freeze({
  compact: { maxSpecialists: 1, maxConcurrent: 1, maxWaves: 1 },
  standard: { maxSpecialists: 4, maxConcurrent: 4, maxWaves: 2 },
  extended: { maxSpecialists: 6, maxConcurrent: 6, maxWaves: 3 }
});
const PROFILE_NAMES = new Set(Object.keys(PROFILE_LIMITS));
const AUTHORIZATION_BUDGETS = Object.freeze({
  paidTools: false,
  credentialedPrivateSystems: false,
  externalWrites: false
});
const PHASES = Object.freeze([
  'setup',
  'evidence',
  'plan',
  'execution',
  'results',
  'crossReview',
  'stageGate',
  'final'
]);
const PHASE_LABELS = Object.freeze({
  setup: 'Setup',
  evidence: 'Evidence',
  plan: 'Plan',
  execution: 'Execution',
  results: 'Results',
  crossReview: 'Cross-review',
  stageGate: 'Stage gate',
  final: 'Final synthesis'
});
const PHASE_ALIASES = Object.freeze({
  'cross-review': 'crossReview',
  'stage-gate': 'stageGate'
});
const PHASE_START_ARTIFACTS = Object.freeze({
  evidence: ['evidence.md', 'work/01-evidence/01-evidence.md'],
  plan: ['plan.md', 'work/02-plan.md'],
  execution: ['execution.md', 'work/03-execution/01-execution.md'],
  results: ['results.md', 'work/04-results/01-results.md'],
  crossReview: ['cross-review.md', 'work/05-cross-review.md'],
  stageGate: ['stage-gate.md', 'work/06-stage-gate.md']
});
const NORMAL_STATUSES = new Set(['pending', 'in_progress', 'complete', 'needs_revision', 'blocked']);
const GATE_STATUSES = new Set(['pending', 'in_progress', 'approved', 'needs_revision', 'blocked']);
const FINAL_STATUSES = new Set(['pending', 'in_progress', 'complete', 'blocked']);
const PLACEHOLDER_PATTERN = /\{\{[^}]+\}\}/g;
const SUPPORTED_WORKFLOW_VERSIONS = new Set(['1.0', '1.1']);
const HUMAN_REVIEW_MODES = new Set(['final-only', 'plan-and-final', 'every-phase']);
const STALE_FINAL_REVIEW_FAILURE = 'stale final output requires a recorded review before finalization';
const ARTIFACT_PHASES = Object.freeze({
  evidence: ['evidence.md', 'work/01-evidence'],
  execution: ['execution.md', 'work/03-execution'],
  results: ['results.md', 'work/04-results']
});
const REQUIRED_HEADINGS = Object.freeze({
  projectBrief: ['# Project Brief', '## Goal', '## Success Criteria', '## Authorization Boundaries', '## Workflow Controls'],
  runLog: ['# Run Log', '## Checkpoints', '## Wave Handoffs', '## Failed Or Repaired Attempts', '## User Review'],
  evidence: ['## Assigned Scope', '## Findings', '## Sources', '## Risks And Unknowns', '## Questions And Handoffs'],
  plan: ['## Goal And Success Criteria', '## Evidence Basis', '## Finding Coverage', '## Work Packages', '## Authorization And Human Gates'],
  execution: ['## Assigned Work', '## Actions And Raw Outcomes', '## Verification', '## Failures And Repairs', '## Handoff To Results'],
  results: ['## Inputs Reviewed', '## Observed Results', '## Finding Coverage', '## Interpretation', '## Recommendations And Handoffs'],
  crossReview: ['## Artifacts Reviewed', '## Missing Evidence, Weak Reasoning, Or Verification Gaps', '## Required Revisions', '## Stage-Gate Guidance'],
  stageGate: ['## Decision', '## Scoring', '## Blocking Issues', '## Required Revisions Or Approval Conditions', '## Human Review Status'],
  final: ['## Executive Summary', '## Findings And Evidence', '## Finding Coverage', '## Recommendations', '## Verification And Workflow Metrics']
});

const scriptPath = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(scriptPath), '..');
const assetsRoot = path.join(skillRoot, 'assets');
const templatePlaceholderCache = new Map();

class CliError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

function printUsage() {
  console.log(`Agentic R&D workflow CLI

Usage:
  rd.mjs init [target] [--profile compact|standard|extended] [--human-review final-only|plan-and-final|every-phase] [--dry-run]
  rd.mjs status [target] [--json]
  rd.mjs advance [target] --phase <evidence|plan|execution|results|cross-review|stage-gate|final> --status <status> [--score N] [--dimensions 2,2,1,1,2] [--blockers N] [--reason text]
  rd.mjs artifact [target] --phase <evidence|execution|results> --name <lowercase-slug>
  rd.mjs validate [target] [--json]
  rd.mjs finalize [target]

Validation reports structural state validity separately from completed-workflow status.
See references/workflow.md for transitions, revision resolution, and recovery.

Exit codes: 0 success, 2 usage, 3 workflow state, 4 filesystem/safety.`);
}

function parseArguments(tokens, optionSchema) {
  const options = {};
  const positional = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }

    const optionName = token.slice(2);
    if (!Object.hasOwn(optionSchema, optionName)) {
      throw new CliError(`Unknown option: --${optionName}`, EXIT.USAGE);
    }
    const optionType = optionSchema[optionName];

    if (optionType === 'boolean') {
      options[optionName] = true;
      continue;
    }

    const value = tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliError(`Option --${optionName} requires a value`, EXIT.USAGE);
    }
    options[optionName] = value;
    index += 1;
  }

  if (positional.length > 1) {
    throw new CliError('Only one target directory may be provided', EXIT.USAGE);
  }

  return { options, targetArgument: positional[0] };
}

function resolveWorkspace(targetArgument) {
  const workspace = path.resolve(targetArgument ?? process.cwd());
  if (!existsSync(workspace)) {
    throw new CliError(`Target directory does not exist: ${workspace}`, EXIT.FILESYSTEM);
  }

  let details;
  try {
    details = lstatSync(workspace);
  } catch (error) {
    throw new CliError(`Cannot inspect target directory: ${error.message}`, EXIT.FILESYSTEM);
  }

  if (details.isSymbolicLink()) {
    throw new CliError(`Refusing a symlinked target directory: ${workspace}`, EXIT.FILESYSTEM);
  }
  if (!details.isDirectory()) {
    throw new CliError(`Target is not a directory: ${workspace}`, EXIT.FILESYSTEM);
  }
  return workspace;
}

function resolveManagedPath(workspace, relativePath) {
  const destination = path.resolve(workspace, relativePath);
  const relation = path.relative(workspace, destination);
  if (relation === '' || (!relation.startsWith('..') && !path.isAbsolute(relation))) {
    return destination;
  }
  throw new CliError(`Managed path escapes the target workspace: ${relativePath}`, EXIT.FILESYSTEM);
}

function assertNoSymlinkComponents(workspace, destination) {
  const relation = path.relative(workspace, destination);
  let current = workspace;
  for (const component of relation.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new CliError(`Refusing managed path through symlink: ${current}`, EXIT.FILESYSTEM);
    }
  }
}

function ensureManagedDirectory(workspace, relativePath, dryRun = false) {
  const destination = resolveManagedPath(workspace, relativePath);
  assertNoSymlinkComponents(workspace, destination);
  if (existsSync(destination)) {
    if (!statSync(destination).isDirectory()) {
      throw new CliError(`Expected a directory: ${destination}`, EXIT.FILESYSTEM);
    }
    return false;
  }
  if (!dryRun) mkdirSync(destination, { recursive: true });
  return true;
}

function copyTemplateIfMissing(workspace, templateName, relativePath, dryRun = false) {
  const destination = resolveManagedPath(workspace, relativePath);
  assertNoSymlinkComponents(workspace, destination);
  if (existsSync(destination)) {
    if (!lstatSync(destination).isFile()) {
      throw new CliError(`Expected a regular file: ${destination}`, EXIT.FILESYSTEM);
    }
    return false;
  }
  ensureManagedDirectory(workspace, path.dirname(relativePath), dryRun);
  if (!dryRun) copyFileSync(path.join(assetsRoot, templateName), destination);
  return true;
}

function writeManagedJson(workspace, relativePath, value) {
  const destination = resolveManagedPath(workspace, relativePath);
  assertNoSymlinkComponents(workspace, destination);
  ensureManagedDirectory(workspace, path.dirname(relativePath));
  const temporaryPath = resolveManagedPath(
    workspace,
    `${relativePath}.${process.pid}.${randomUUID()}.tmp`
  );
  assertNoSymlinkComponents(workspace, temporaryPath);
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryPath, destination);
  } catch (error) {
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error; a stale temp file is safer than masking it.
    }
    throw error;
  }
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new CliError(`Cannot parse ${label}: ${error.message}`, EXIT.STATE);
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function statePath(workspace) {
  return resolveManagedPath(workspace, 'work/run-state.json');
}

function readState(workspace) {
  const filePath = statePath(workspace);
  if (!existsSync(filePath)) {
    throw new CliError('No v1 workflow state found. Run init first.', EXIT.STATE);
  }
  assertNoSymlinkComponents(workspace, filePath);
  const state = readJsonFile(filePath, 'work/run-state.json');
  if (!isRecord(state)) {
    throw new CliError('Workflow state must be a JSON object.', EXIT.STATE);
  }
  if (state.schemaVersion !== 1 || !SUPPORTED_WORKFLOW_VERSIONS.has(state.workflowVersion)) {
    throw new CliError('Unsupported workflow state version; expected v1.0 or v1.1.', EXIT.STATE);
  }
  if (!PROFILE_NAMES.has(state.profile)) {
    throw new CliError(`Unknown profile in workflow state: ${state.profile}`, EXIT.STATE);
  }
  if (
    !isRecord(state.phases)
    || !isRecord(state.budgets)
    || !isRecord(state.metrics)
    || !isRecord(state.stageGate)
    || typeof state.finalStale !== 'boolean'
  ) {
    throw new CliError('Workflow state is missing required v1 fields.', EXIT.STATE);
  }
  if (
    PHASES.some((phase) => typeof state.phases[phase] !== 'string')
    || typeof state.currentPhase !== 'string'
    || !Number.isSafeInteger(state.revisionRounds)
    || state.revisionRounds < 0
    || !Number.isSafeInteger(state.budgets.maxRevisionRounds)
    || !Number.isSafeInteger(state.metrics.phaseTransitions)
    || !Number.isSafeInteger(state.metrics.executionAttempts)
    || !Number.isSafeInteger(state.stageGate.blockers)
    || (state.stageGate.score !== null && !Number.isSafeInteger(state.stageGate.score))
    || (state.stageGate.dimensions !== null && !Array.isArray(state.stageGate.dimensions))
    || (state.stageGate.decision !== null && typeof state.stageGate.decision !== 'string')
    || typeof state.createdAt !== 'string'
    || typeof state.updatedAt !== 'string'
    || !HUMAN_REVIEW_MODES.has(state.humanReview)
    || (state.lastReason !== null && typeof state.lastReason !== 'string')
    || Object.keys(AUTHORIZATION_BUDGETS).some((name) => typeof state.budgets[name] !== 'boolean')
  ) {
    throw new CliError('Workflow state contains invalid v1 field types.', EXIT.STATE);
  }
  if (state.revisions === undefined) state.revisions = [];
  if (state.pendingRevisionId === undefined) state.pendingRevisionId = null;
  if (!Array.isArray(state.revisions) || (state.pendingRevisionId !== null && typeof state.pendingRevisionId !== 'string')) {
    throw new CliError('Workflow state contains invalid revision metadata.', EXIT.STATE);
  }
  return state;
}

function newState(profile, humanReview) {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 1,
    workflowVersion: '1.1',
    profile,
    createdAt: timestamp,
    updatedAt: timestamp,
    currentPhase: 'setup',
    humanReview,
    phases: Object.fromEntries(PHASES.map((phase) => [phase, phase === 'setup' ? 'in_progress' : 'pending'])),
    revisionRounds: 0,
    revisions: [],
    pendingRevisionId: null,
    stageGate: { decision: null, score: null, dimensions: null, blockers: 0 },
    finalStale: false,
    budgets: {
      ...PROFILE_LIMITS[profile],
      maxRevisionRounds: 2,
      ...AUTHORIZATION_BUDGETS
    },
    metrics: { phaseTransitions: 0, executionAttempts: 0 },
    lastReason: null
  };
}

function detectLegacyOrForeignWork(workspace) {
  const workPath = resolveManagedPath(workspace, 'work');
  if (!existsSync(workPath)) return;
  assertNoSymlinkComponents(workspace, workPath);
  if (!statSync(workPath).isDirectory()) {
    throw new CliError('The reserved work path exists and is not a directory.', EXIT.FILESYSTEM);
  }
  const entries = readdirSync(workPath);
  if (entries.length > 0 && !entries.includes('run-state.json')) {
    throw new CliError(
      'A non-v1 work directory already exists. v0.3 migration is intentionally unsupported; preserve it and initialize in a clean workspace.',
      EXIT.STATE
    );
  }
}

function commandInit(tokens) {
  const parsed = parseArguments(tokens, { profile: 'value', 'human-review': 'value', 'dry-run': 'boolean' });
  const workspace = resolveWorkspace(parsed.targetArgument);
  const dryRun = Boolean(parsed.options['dry-run']);
  const requestedProfile = parsed.options.profile;
  const requestedHumanReview = parsed.options['human-review'];
  if (requestedProfile && !PROFILE_NAMES.has(requestedProfile)) {
    throw new CliError(`Unknown profile: ${requestedProfile}`, EXIT.USAGE);
  }
  if (requestedHumanReview && !HUMAN_REVIEW_MODES.has(requestedHumanReview)) {
    throw new CliError(`Unknown human-review mode: ${requestedHumanReview}`, EXIT.USAGE);
  }

  const existingStatePath = statePath(workspace);
  detectLegacyOrForeignWork(workspace);

  let state;
  let stateCreated = false;
  if (existsSync(existingStatePath)) {
    state = readState(workspace);
    if (requestedProfile && requestedProfile !== state.profile) {
      throw new CliError(
        `Workflow already uses profile ${state.profile}; refusing to change it to ${requestedProfile}.`,
        EXIT.STATE
      );
    }
    if (requestedHumanReview && requestedHumanReview !== state.humanReview) {
      throw new CliError(
        `Workflow already uses human-review mode ${state.humanReview}; refusing to change it to ${requestedHumanReview}.`,
        EXIT.STATE
      );
    }
  } else {
    state = newState(requestedProfile ?? 'standard', requestedHumanReview ?? 'final-only');
    stateCreated = true;
  }

  const plannedResults = [
    ['project-brief.md', (preview) => copyTemplateIfMissing(workspace, 'project-brief.md', 'project-brief.md', preview)],
    ['work/', (preview) => ensureManagedDirectory(workspace, 'work', preview)],
    ['work/00-run-log.md', (preview) => copyTemplateIfMissing(workspace, 'run-log.md', 'work/00-run-log.md', preview)],
    ['work/01-evidence/', (preview) => ensureManagedDirectory(workspace, 'work/01-evidence', preview)],
    ['work/03-execution/', (preview) => ensureManagedDirectory(workspace, 'work/03-execution', preview)],
    ['work/04-results/', (preview) => ensureManagedDirectory(workspace, 'work/04-results', preview)]
  ];

  // Validate every destination before the first write. A conflict in a later path
  // must not leave a newly created brief or partial directory tree behind.
  if (!dryRun) {
    for (const [, apply] of plannedResults) apply(true);
  }
  const results = plannedResults.map(([item, apply]) => [item, apply(dryRun)]);

  if (stateCreated && !dryRun) writeManagedJson(workspace, 'work/run-state.json', state);
  results.splice(2, 0, ['work/run-state.json', stateCreated]);

  for (const [item, created] of results) {
    console.log(`${dryRun ? 'would ' : ''}${created ? 'create' : 'keep'} ${item}`);
  }
  console.log(`profile ${state.profile}`);
  console.log(`human review ${state.humanReview}`);
  console.log(dryRun ? 'dry-run complete; no files written' : 'next: complete project-brief.md, then start evidence');
}

function listMarkdownFiles(workspace, relativeDirectory) {
  const directory = resolveManagedPath(workspace, relativeDirectory);
  assertNoSymlinkComponents(workspace, directory);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.name.toLowerCase().endsWith('.md')) continue;
    const filePath = resolveManagedPath(workspace, path.join(relativeDirectory, entry.name));
    assertNoSymlinkComponents(workspace, filePath);
    if (!entry.isFile()) {
      throw new CliError(`Expected a regular Markdown artifact: ${filePath}`, EXIT.STATE);
    }
    files.push(filePath);
  }
  return files;
}

function assertRequiredHeadings(content, relativePath, requiredHeadings = []) {
  const headings = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = requiredHeadings.filter((heading) => !headings.has(heading));
  if (missing.length > 0) {
    throw new CliError(`Artifact is missing required headings (${missing.join(', ')}): ${relativePath}`, EXIT.STATE);
  }
}

function templatePlaceholders(templateName) {
  if (!templatePlaceholderCache.has(templateName)) {
    const template = readFileSync(path.join(assetsRoot, templateName), 'utf8');
    templatePlaceholderCache.set(templateName, [...new Set(template.match(PLACEHOLDER_PATTERN) ?? [])]);
  }
  return templatePlaceholderCache.get(templateName);
}

function containsTemplatePlaceholder(content, templateName) {
  return templatePlaceholders(templateName).some((placeholder) => content.includes(placeholder));
}

function assertFilledFile(workspace, relativePath, requiredHeadings = [], templateName) {
  const filePath = resolveManagedPath(workspace, relativePath);
  assertNoSymlinkComponents(workspace, filePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new CliError(`Missing required artifact: ${relativePath}`, EXIT.STATE);
  }
  const content = readFileSync(filePath, 'utf8');
  if (content.trim().length === 0) {
    throw new CliError(`Artifact is empty: ${relativePath}`, EXIT.STATE);
  }
  if (containsTemplatePlaceholder(content, templateName)) {
    throw new CliError(`Artifact still contains template placeholders: ${relativePath}`, EXIT.STATE);
  }
  assertRequiredHeadings(content, relativePath, requiredHeadings);
}

function assertFilledDirectory(workspace, relativePath, requiredHeadings = [], templateName) {
  const files = listMarkdownFiles(workspace, relativePath);
  if (files.length === 0) {
    throw new CliError(`No Markdown artifacts found in ${relativePath}`, EXIT.STATE);
  }
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const relativeFile = path.relative(workspace, filePath).split(path.sep).join('/');
    if (content.trim().length === 0 || containsTemplatePlaceholder(content, templateName)) {
      throw new CliError(`Incomplete artifact: ${relativeFile}`, EXIT.STATE);
    }
    assertRequiredHeadings(content, relativeFile, requiredHeadings);
  }
}

function strictHeadings(state, artifactType) {
  return state.workflowVersion === '1.1' ? REQUIRED_HEADINGS[artifactType] : [];
}

function assertSetupReady(workspace, state) {
  assertFilledFile(workspace, 'project-brief.md', strictHeadings(state, 'projectBrief'), 'project-brief.md');
  assertFilledFile(workspace, 'work/00-run-log.md', strictHeadings(state, 'runLog'), 'run-log.md');
}

function assertPhaseArtifact(workspace, phase, state) {
  switch (phase) {
    case 'setup':
      assertSetupReady(workspace, state);
      return;
    case 'evidence':
      assertSetupReady(workspace, state);
      assertFilledDirectory(workspace, 'work/01-evidence', strictHeadings(state, 'evidence'), 'evidence.md');
      return;
    case 'plan':
      assertFilledFile(workspace, 'work/02-plan.md', strictHeadings(state, 'plan'), 'plan.md');
      return;
    case 'execution':
      assertFilledDirectory(workspace, 'work/03-execution', strictHeadings(state, 'execution'), 'execution.md');
      return;
    case 'results':
      assertFilledDirectory(workspace, 'work/04-results', strictHeadings(state, 'results'), 'results.md');
      return;
    case 'crossReview':
      assertFilledFile(workspace, 'work/05-cross-review.md', strictHeadings(state, 'crossReview'), 'cross-review.md');
      return;
    case 'stageGate':
      assertFilledFile(workspace, 'work/06-stage-gate.md', strictHeadings(state, 'stageGate'), 'stage-gate.md');
      return;
    case 'final':
      assertFilledFile(workspace, 'work/07-final-output.md', strictHeadings(state, 'final'), 'final-output.md');
      return;
    default:
      return;
  }
}

function statusSetForPhase(phase) {
  if (phase === 'stageGate') return GATE_STATUSES;
  if (phase === 'final') return FINAL_STATUSES;
  return NORMAL_STATUSES;
}

function canonicalPhase(value) {
  return PHASE_ALIASES[value] ?? value;
}

function cliPhaseName(phase) {
  if (phase === 'crossReview') return 'cross-review';
  if (phase === 'stageGate') return 'stage-gate';
  return phase;
}

function phaseIsSatisfied(state, phase) {
  if (phase === 'stageGate') return state.phases[phase] === 'approved';
  return state.phases[phase] === 'complete';
}

function assertPredecessor(state, phase) {
  const index = PHASES.indexOf(phase);
  if (index <= 0) return;
  const predecessor = PHASES[index - 1];
  if (!phaseIsSatisfied(state, predecessor)) {
    throw new CliError(
      `${PHASE_LABELS[phase]} cannot advance before ${PHASE_LABELS[predecessor]} is complete.`,
      EXIT.STATE
    );
  }
}

function resetLaterPhases(state, phase, workspace) {
  const phaseIndex = PHASES.indexOf(phase);
  const finalPath = resolveManagedPath(workspace, 'work/07-final-output.md');
  if (phaseIndex < PHASES.indexOf('final') && (state.phases.final !== 'pending' || existsSync(finalPath))) {
    state.finalStale = true;
  }
  for (const laterPhase of PHASES.slice(phaseIndex + 1)) {
    state.phases[laterPhase] = 'pending';
  }
  state.stageGate = { decision: null, score: null, dimensions: null, blockers: 0 };
}

function revisionArtifactPaths(workspace) {
  const paths = ['project-brief.md', 'work/00-run-log.md'];
  for (const directory of ['work/01-evidence', 'work/03-execution', 'work/04-results']) {
    for (const filePath of listMarkdownFiles(workspace, directory)) {
      paths.push(path.relative(workspace, filePath).split(path.sep).join('/'));
    }
  }
  for (const relativePath of ['work/02-plan.md', 'work/05-cross-review.md']) {
    if (existsSync(resolveManagedPath(workspace, relativePath))) paths.push(relativePath);
  }
  return [...new Set(paths)].sort();
}

function fingerprintRevisionArtifacts(workspace) {
  const hash = createHash('sha256');
  for (const relativePath of revisionArtifactPaths(workspace)) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileSync(resolveManagedPath(workspace, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function pendingRevision(state) {
  if (state.pendingRevisionId === null) return null;
  return state.revisions.find((revision) => isRecord(revision) && revision.id === state.pendingRevisionId) ?? null;
}

function parseIntegerOption(value, name, defaultValue = undefined) {
  if (value === undefined) return defaultValue;
  if (!/^\d+$/.test(value)) throw new CliError(`--${name} must be a non-negative integer`, EXIT.USAGE);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new CliError(`--${name} must be a safe non-negative integer`, EXIT.USAGE);
  }
  return parsed;
}

function parseDimensions(value, required = false) {
  if (value === undefined) {
    if (required) throw new CliError('--dimensions is required for stage-gate approval', EXIT.STATE);
    return null;
  }
  const dimensions = value.split(',').map((item) => Number(item.trim()));
  if (dimensions.length !== 5 || dimensions.some((item) => !Number.isInteger(item) || item < 0 || item > 2)) {
    throw new CliError('--dimensions must contain five comma-separated scores from 0 to 2', EXIT.USAGE);
  }
  return dimensions;
}

function commandAdvance(tokens) {
  const parsed = parseArguments(tokens, {
    phase: 'value',
    status: 'value',
    score: 'value',
    dimensions: 'value',
    blockers: 'value',
    reason: 'value'
  });
  const workspace = resolveWorkspace(parsed.targetArgument);
  const state = readState(workspace);
  const phase = canonicalPhase(parsed.options.phase);
  const status = parsed.options.status;

  if (!phase || !PHASES.includes(phase) || phase === 'setup') {
    throw new CliError(`--phase must be one of: ${PHASES.slice(1).map(cliPhaseName).join(', ')}`, EXIT.USAGE);
  }
  if (!status || !statusSetForPhase(phase).has(status)) {
    throw new CliError(`Invalid status for ${phase}: ${status ?? '<missing>'}`, EXIT.USAGE);
  }
  if (status === 'pending') {
    throw new CliError('The pending status is managed internally and cannot be set with advance.', EXIT.USAGE);
  }
  if (
    phase !== 'stageGate'
    && ['score', 'dimensions', 'blockers'].some((name) => parsed.options[name] !== undefined)
  ) {
    throw new CliError('--score, --dimensions, and --blockers are valid only for stage-gate.', EXIT.USAGE);
  }

  const score = parseIntegerOption(parsed.options.score, 'score');
  const dimensions = parseDimensions(parsed.options.dimensions, phase === 'stageGate' && status === 'approved');
  const blockers = parseIntegerOption(parsed.options.blockers, 'blockers', 0);
  const staleFinalRecovery = phase === 'final' && status === 'in_progress' && state.finalStale;
  if (staleFinalRecovery && !parsed.options.reason) {
    throw new CliError('Revising a stale final output requires --reason to record the review.', EXIT.STATE);
  }
  assertValidState(
    workspace,
    state,
    'Refusing to mutate an invalid workflow',
    staleFinalRecovery ? [STALE_FINAL_REVIEW_FAILURE] : []
  );

  if (phase === 'evidence' && status === 'in_progress' && state.phases.setup !== 'complete') {
    assertSetupReady(workspace, state);
    state.phases.setup = 'complete';
  }

  const currentIndex = PHASES.indexOf(state.currentPhase);
  const targetIndex = PHASES.indexOf(phase);
  const reopeningEarlierPhase = targetIndex < currentIndex;

  if (reopeningEarlierPhase && status === 'complete') {
    throw new CliError(`Reopen ${PHASE_LABELS[phase]} with in_progress before completing it again.`, EXIT.STATE);
  }

  if (reopeningEarlierPhase && ['in_progress', 'needs_revision', 'blocked'].includes(status)) {
    resetLaterPhases(state, phase, workspace);
  }

  if (status === 'in_progress') {
    const revising = state.phases.stageGate === 'needs_revision' && targetIndex < PHASES.indexOf('stageGate');
    if (!revising) assertPredecessor(state, phase);
    if (!reopeningEarlierPhase && revising) resetLaterPhases(state, phase, workspace);
    if (phase === 'execution') state.metrics.executionAttempts += 1;
  }

  if (status === 'complete') {
    assertPredecessor(state, phase);
    assertPhaseArtifact(workspace, phase, state);
  }

  if (status === 'needs_revision' || status === 'blocked') assertPredecessor(state, phase);

  if (phase === 'stageGate') {
    if (status === 'in_progress') {
      state.stageGate = { decision: null, score: null, dimensions: null, blockers: 0 };
    } else if (status === 'approved') {
      assertPredecessor(state, phase);
      assertPhaseArtifact(workspace, phase, state);
      if (score === undefined || score < 8 || score > 10) {
        throw new CliError('Stage-gate approval requires --score between 8 and 10.', EXIT.STATE);
      }
      if (dimensions.some((item) => item === 0) || dimensions.reduce((total, item) => total + item, 0) !== score) {
        throw new CliError('Stage-gate dimensions must be non-zero and sum to --score.', EXIT.STATE);
      }
      if (blockers !== 0) {
        throw new CliError('Stage-gate approval requires --blockers 0.', EXIT.STATE);
      }
      const revision = pendingRevision(state);
      if (revision) {
        const currentHash = fingerprintRevisionArtifacts(workspace);
        const artifactsChanged = currentHash !== revision.baselineHash;
        if (!artifactsChanged && !parsed.options.reason) {
          throw new CliError(
            `Revision ${revision.id} has no upstream artifact change; provide --reason with an explicit no-change disposition.`,
            EXIT.STATE
          );
        }
        revision.resolvedAt = new Date().toISOString();
        revision.resolution = artifactsChanged ? 'upstream_change' : 'no_change_disposition';
        revision.resolutionReason = parsed.options.reason ?? null;
        revision.resolvedHash = currentHash;
        state.pendingRevisionId = null;
      }
      state.stageGate = { decision: 'approved', score, dimensions, blockers: 0 };
    } else if (status === 'needs_revision') {
      assertPhaseArtifact(workspace, phase, state);
      if (!parsed.options.reason) {
        throw new CliError('Stage-gate needs_revision requires --reason to record the requested change.', EXIT.STATE);
      }
      if (pendingRevision(state)) {
        throw new CliError(`Revision ${state.pendingRevisionId} is still pending.`, EXIT.STATE);
      }
      if (state.revisionRounds >= state.budgets.maxRevisionRounds) {
        throw new CliError('Revision limit reached; mark the workflow blocked.', EXIT.STATE);
      }
      state.revisionRounds += 1;
      const revision = {
        id: `R${state.revisionRounds}`,
        requestedAt: new Date().toISOString(),
        requestReason: parsed.options.reason,
        baselineHash: fingerprintRevisionArtifacts(workspace),
        resolvedAt: null,
        resolution: null,
        resolutionReason: null,
        resolvedHash: null
      };
      state.revisions.push(revision);
      state.pendingRevisionId = revision.id;
      state.stageGate = { decision: 'needs_revision', score: score ?? null, dimensions, blockers };
    } else if (status === 'blocked') {
      state.stageGate = { decision: 'blocked', score: score ?? null, dimensions, blockers: Math.max(1, blockers) };
    }
  }

  if (phase === 'final' && status === 'in_progress' && state.finalStale) {
    if (!parsed.options.reason) {
      throw new CliError('Revising a stale final output requires --reason to record the review.', EXIT.STATE);
    }
    state.finalStale = false;
  }

  if (phase === 'final' && status === 'complete') {
    if (state.phases.stageGate !== 'approved') {
      throw new CliError('Final synthesis cannot complete before stage-gate approval.', EXIT.STATE);
    }
    if (state.finalStale) {
      throw new CliError('Final output is stale; reopen it with in_progress and --reason before completion.', EXIT.STATE);
    }
    assertPhaseArtifact(workspace, phase, state);
  }

  state.phases[phase] = status;
  state.currentPhase = phase;
  state.updatedAt = new Date().toISOString();
  state.metrics.phaseTransitions += 1;
  state.lastReason = parsed.options.reason ?? null;
  const allowedCandidateFailures = state.finalStale && state.phases.stageGate === 'approved'
    ? [STALE_FINAL_REVIEW_FAILURE]
    : [];
  assertValidState(
    workspace,
    state,
    'Refusing to persist an invalid workflow transition',
    allowedCandidateFailures
  );

  let createdArtifact = null;
  if (status === 'in_progress' && PHASE_START_ARTIFACTS[phase]) {
    const [templateName, relativePath] = PHASE_START_ARTIFACTS[phase];
    if (copyTemplateIfMissing(workspace, templateName, relativePath)) createdArtifact = relativePath;
  }

  writeManagedJson(workspace, 'work/run-state.json', state);
  console.log(`${cliPhaseName(phase)} -> ${status}`);
  if (createdArtifact) console.log(`created ${createdArtifact}`);
  if (phase === 'stageGate') console.log(`revision rounds ${state.revisionRounds}/${state.budgets.maxRevisionRounds}`);
}

function validateState(workspace, state) {
  const failures = [];
  const capture = (callback) => {
    try {
      callback();
    } catch (error) {
      failures.push(error.message);
    }
  };

  for (const relativePath of ['project-brief.md', 'work/00-run-log.md']) {
    capture(() => {
      const filePath = resolveManagedPath(workspace, relativePath);
      assertNoSymlinkComponents(workspace, filePath);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        throw new CliError(`Missing required file: ${relativePath}`, EXIT.STATE);
      }
    });
  }
  for (const relativePath of ['work/01-evidence', 'work/03-execution', 'work/04-results']) {
    capture(() => {
      const directory = resolveManagedPath(workspace, relativePath);
      assertNoSymlinkComponents(workspace, directory);
      if (!existsSync(directory) || !statSync(directory).isDirectory()) {
        throw new CliError(`Missing required directory: ${relativePath}`, EXIT.STATE);
      }
    });
  }

  for (const phase of PHASES) {
    const status = state.phases[phase];
    if (!statusSetForPhase(phase).has(status)) failures.push(`Invalid status for ${phase}: ${status}`);
    if (status === 'complete' || status === 'approved') capture(() => assertPhaseArtifact(workspace, phase, state));
  }
  const laterPhaseStarted = PHASES.slice(1).some((phase) => state.phases[phase] !== 'pending');
  if (laterPhaseStarted && state.phases.setup !== 'complete') failures.push('setup must be complete before later phases start');
  if (!laterPhaseStarted && !['in_progress', 'complete'].includes(state.phases.setup)) {
    failures.push('setup must be in_progress or complete before evidence starts');
  }
  if (!PHASES.includes(state.currentPhase)) failures.push(`Invalid currentPhase: ${state.currentPhase}`);

  for (let index = 1; index < PHASES.length; index += 1) {
    const phase = PHASES[index];
    if (state.phases[phase] !== 'pending') {
      const predecessor = PHASES[index - 1];
      if (!phaseIsSatisfied(state, predecessor)) {
        failures.push(`${phase} is active while predecessor ${predecessor} is incomplete`);
      }
    }
  }

  const finalPath = resolveManagedPath(workspace, 'work/07-final-output.md');
  if (existsSync(finalPath) && state.phases.stageGate !== 'approved' && !state.finalStale) {
    failures.push('Final output exists without stage-gate approval');
  }
  if (state.finalStale && !existsSync(finalPath)) failures.push('finalStale is set but no final output exists');
  if (state.finalStale && state.phases.final !== 'pending') failures.push('Stale final output must remain pending');
  if (state.finalStale && state.phases.stageGate === 'approved') {
    failures.push(STALE_FINAL_REVIEW_FAILURE);
  }
  const expectedGateDecision = ['approved', 'needs_revision', 'blocked'].includes(state.phases.stageGate)
    ? state.phases.stageGate
    : null;
  if (state.stageGate.decision !== expectedGateDecision) {
    failures.push('Stage-gate decision metadata does not match its phase status');
  }
  const dimensions = state.stageGate.dimensions;
  const score = state.stageGate.score;
  const dimensionsInvalid = dimensions !== null && (
    dimensions.length !== 5
    || dimensions.some((item) => !Number.isInteger(item) || item < 0 || item > 2)
  );
  if (score !== null && (score < 0 || score > 10)) failures.push('Stage-gate score must be between 0 and 10');
  if (dimensionsInvalid) failures.push('Stage-gate dimensions must contain five scores from 0 to 2');
  if (
    score !== null
    && dimensions !== null
    && !dimensionsInvalid
    && dimensions.reduce((total, item) => total + item, 0) !== score
  ) {
    failures.push('Stage-gate dimensions must sum to its score');
  }
  if (state.stageGate.blockers < 0) failures.push('Stage-gate blockers must be a non-negative integer');
  if (
    expectedGateDecision === null
    && (score !== null || dimensions !== null || state.stageGate.blockers !== 0)
  ) {
    failures.push('Inactive stage gate cannot retain decision metadata');
  }
  if (state.phases.stageGate === 'approved') {
    const invalidApprovalDimensions = dimensionsInvalid
      || dimensions === null
      || dimensions.some((item) => item === 0);
    if (score === null || score < 8 || state.stageGate.blockers !== 0 || invalidApprovalDimensions) {
      failures.push('Approved gate has an invalid score or blockers');
    }
  }
  if (state.phases.stageGate === 'blocked' && state.stageGate.blockers < 1) {
    failures.push('Blocked stage gate must record at least one blocker');
  }
  if (state.revisionRounds > state.budgets.maxRevisionRounds) {
    failures.push('Revision round limit exceeded');
  }
  const revisionIds = new Set();
  for (const revision of state.revisions) {
    if (
      !isRecord(revision)
      || typeof revision.id !== 'string'
      || typeof revision.requestedAt !== 'string'
      || typeof revision.requestReason !== 'string'
      || typeof revision.baselineHash !== 'string'
      || !/^[0-9a-f]{64}$/.test(revision.baselineHash)
      || (revision.resolvedAt !== null && typeof revision.resolvedAt !== 'string')
      || (revision.resolution !== null && !['upstream_change', 'no_change_disposition'].includes(revision.resolution))
      || (revision.resolutionReason !== null && typeof revision.resolutionReason !== 'string')
      || (revision.resolvedHash !== null && !/^[0-9a-f]{64}$/.test(revision.resolvedHash))
    ) {
      failures.push('Revision history contains invalid metadata');
      continue;
    }
    if (revisionIds.has(revision.id)) failures.push(`Duplicate revision id: ${revision.id}`);
    revisionIds.add(revision.id);
    const resolvedFields = [revision.resolvedAt, revision.resolution, revision.resolvedHash];
    const resolvedCount = resolvedFields.filter((value) => value !== null).length;
    if (resolvedCount !== 0 && resolvedCount !== resolvedFields.length) {
      failures.push(`Revision ${revision.id} has incomplete resolution metadata`);
    }
  }
  if (state.workflowVersion === '1.1' && state.revisionRounds !== state.revisions.length) {
    failures.push('revisionRounds must match revision history length');
  }
  if (state.workflowVersion === '1.0' && state.revisions.length > state.revisionRounds) {
    failures.push('revision history cannot exceed revisionRounds');
  }
  const unresolvedRevisions = state.revisions.filter(
    (revision) => isRecord(revision) && revision.resolvedAt === null
  );
  if (state.pendingRevisionId !== null) {
    const pending = pendingRevision(state);
    if (!pending) failures.push('pendingRevisionId does not reference revision history');
    else if (pending.resolvedAt !== null) failures.push('pendingRevisionId references a resolved revision');
  }
  if (unresolvedRevisions.length > 1) failures.push('Only one revision may be pending');
  if (unresolvedRevisions.length === 1 && unresolvedRevisions[0].id !== state.pendingRevisionId) {
    failures.push('Unresolved revision does not match pendingRevisionId');
  }
  if (state.phases.stageGate === 'needs_revision' && state.pendingRevisionId === null) {
    failures.push('Stage gate needs_revision requires pending revision metadata');
  }
  if (state.phases.stageGate === 'approved' && state.pendingRevisionId !== null) {
    failures.push('Approved stage gate cannot retain a pending revision');
  }
  if (state.budgets.maxRevisionRounds !== 2) failures.push('maxRevisionRounds must remain 2');
  for (const [name, expected] of Object.entries(PROFILE_LIMITS[state.profile])) {
    if (state.budgets[name] !== expected) failures.push(`${name} must match the ${state.profile} profile`);
  }
  for (const [name, expected] of Object.entries(AUTHORIZATION_BUDGETS)) {
    if (state.budgets[name] !== expected) failures.push(`${name} must remain ${expected}`);
  }
  for (const name of ['phaseTransitions', 'executionAttempts']) {
    if (state.metrics[name] < 0) failures.push(`${name} must be a non-negative integer`);
  }
  if (PHASES.includes(state.currentPhase) && state.phases[state.currentPhase] === 'pending') {
    failures.push('currentPhase cannot point to a pending phase');
  }
  const expectedCurrentPhase = [...PHASES].reverse().find((phase) => state.phases[phase] !== 'pending');
  if (expectedCurrentPhase && state.currentPhase !== expectedCurrentPhase) {
    failures.push(`currentPhase must match the latest started phase (${expectedCurrentPhase})`);
  }
  return [...new Set(failures)];
}

function workflowIsComplete(state) {
  return PHASES.every((phase) => phaseIsSatisfied(state, phase));
}

function assertValidState(workspace, state, prefix = 'Workflow state or artifacts are invalid', allowedFailures = []) {
  const allowed = new Set(allowedFailures);
  const failures = validateState(workspace, state).filter((failure) => !allowed.has(failure));
  if (failures.length > 0) {
    throw new CliError(`${prefix}: ${failures.join('; ')}`, EXIT.STATE);
  }
}

function commandValidate(tokens) {
  const parsed = parseArguments(tokens, { json: 'boolean' });
  const workspace = resolveWorkspace(parsed.targetArgument);
  const state = readState(workspace);
  const failures = validateState(workspace, state);
  const complete = failures.length === 0 && workflowIsComplete(state);
  if (parsed.options.json) {
    console.log(JSON.stringify({
      valid: failures.length === 0,
      complete,
      status: failures.length > 0 ? 'invalid' : complete ? 'valid_complete' : 'valid_incomplete',
      currentPhase: state.currentPhase,
      failures
    }, null, 2));
  } else if (failures.length === 0) {
    console.log(complete
      ? 'Completed workflow validation passed.'
      : `Workflow state is valid but incomplete (current phase: ${PHASE_LABELS[state.currentPhase]}).`);
  } else {
    console.error('Workflow validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
  }
  if (failures.length > 0) throw new CliError('Workflow state or artifacts are invalid.', EXIT.STATE);
}

function nextAction(state, failures = []) {
  if (failures.length > 0) return 'run validate, reconcile the reported state/artifact failures, then retry';
  if (workflowIsComplete(state)) return 'workflow complete';
  if (state.phases.setup === 'in_progress') {
    return 'complete project-brief.md and work/00-run-log.md, then start Evidence';
  }
  if (state.finalStale && state.phases.stageGate === 'approved') {
    return 'review the preserved final output, then reopen Final synthesis with in_progress and --reason';
  }
  if (state.finalStale) return 'complete the revised phases and obtain stage-gate approval again';
  if (state.phases.stageGate === 'approved' && state.phases.final === 'pending') {
    return 'run finalize to create the final synthesis template';
  }
  const activePhase = PHASES.find((phase) => ['in_progress', 'needs_revision', 'blocked'].includes(state.phases[phase]));
  if (state.pendingRevisionId !== null) {
    if (activePhase && activePhase !== 'stageGate') {
      return `complete revised ${PHASE_LABELS[activePhase]} artifacts for ${state.pendingRevisionId}, then continue through Cross-review and Stage gate`;
    }
    return `resolve ${state.pendingRevisionId} by changing an upstream artifact or recording an explicit no-change disposition, then rerun Stage gate`;
  }
  if (activePhase) {
    const actions = {
      evidence: 'complete evidence artifacts, reconcile wave handoffs in work/00-run-log.md, then mark Evidence complete',
      plan: 'complete work/02-plan.md and any required plan review, then mark Plan complete',
      execution: 'complete and verify execution artifacts, then mark Execution complete',
      results: 'complete result artifacts with observed/inferred distinctions, then mark Results complete',
      crossReview: 'close owned revisions in source artifacts and record them in the run log, then mark Cross-review complete',
      stageGate: 'score all five dimensions and record Approved, Needs Revision, or Blocked',
      final: 'complete work/07-final-output.md and required human review, then mark Final synthesis complete'
    };
    return actions[activePhase] ?? `resolve ${PHASE_LABELS[activePhase]}`;
  }
  const pendingPhase = PHASES.find((phase) => state.phases[phase] === 'pending');
  return pendingPhase ? `start ${PHASE_LABELS[pendingPhase]} with advance --status in_progress` : 'workflow complete';
}

function commandStatus(tokens) {
  const parsed = parseArguments(tokens, { json: 'boolean' });
  const workspace = resolveWorkspace(parsed.targetArgument);
  const state = readState(workspace);
  const failures = validateState(workspace, state);
  const complete = failures.length === 0 && workflowIsComplete(state);
  const action = nextAction(state, failures);
  if (parsed.options.json) {
    console.log(JSON.stringify({
      ...state,
      workflowComplete: complete,
      validation: { valid: failures.length === 0, failures },
      nextAction: action
    }, null, 2));
    return;
  }
  console.log(`profile: ${state.profile}`);
  console.log(`current phase: ${state.currentPhase}`);
  for (const phase of PHASES) console.log(`${cliPhaseName(phase)}: ${state.phases[phase]}`);
  console.log(`revision rounds: ${state.revisionRounds}/${state.budgets.maxRevisionRounds}`);
  console.log(`final output stale: ${state.finalStale ? 'yes' : 'no'}`);
  console.log(`workflow complete: ${complete ? 'yes' : 'no'}`);
  console.log(`state valid: ${failures.length === 0 ? 'yes' : 'no'}`);
  console.log(`next: ${action}`);
  console.log(`updated: ${state.updatedAt}`);
}

function commandFinalize(tokens) {
  const parsed = parseArguments(tokens, {});
  const workspace = resolveWorkspace(parsed.targetArgument);
  const state = readState(workspace);
  assertValidState(workspace, state, 'Refusing to finalize an invalid workflow');
  if (state.phases.stageGate !== 'approved') {
    throw new CliError('Cannot create final output before stage-gate approval.', EXIT.STATE);
  }
  if (state.finalStale) {
    throw new CliError(
      'Existing final output is stale. Run advance --phase final --status in_progress --reason <review reason> before reuse.',
      EXIT.STATE
    );
  }
  let created;
  if (state.phases.final === 'pending') {
    state.phases.final = 'in_progress';
    state.currentPhase = 'final';
    state.updatedAt = new Date().toISOString();
    state.metrics.phaseTransitions += 1;
    assertValidState(workspace, state, 'Refusing to persist an invalid finalization transition');
    created = copyTemplateIfMissing(workspace, 'final-output.md', 'work/07-final-output.md');
    writeManagedJson(workspace, 'work/run-state.json', state);
  } else {
    created = copyTemplateIfMissing(workspace, 'final-output.md', 'work/07-final-output.md');
  }
  console.log(`${created ? 'created' : 'kept'} work/07-final-output.md`);
}

function commandArtifact(tokens) {
  const parsed = parseArguments(tokens, { phase: 'value', name: 'value' });
  const workspace = resolveWorkspace(parsed.targetArgument);
  const phase = canonicalPhase(parsed.options.phase);
  const name = parsed.options.name;
  if (!phase || !ARTIFACT_PHASES[phase]) {
    throw new CliError('--phase must be one of: evidence, execution, results', EXIT.USAGE);
  }
  if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    throw new CliError('--name must be a lowercase slug using letters, numbers, and hyphens', EXIT.USAGE);
  }
  const state = readState(workspace);
  assertValidState(workspace, state, 'Refusing to create an artifact in an invalid workflow');
  if (state.phases[phase] !== 'in_progress') {
    throw new CliError(`${PHASE_LABELS[phase]} must be in_progress before adding an artifact.`, EXIT.STATE);
  }
  const [templateName, directory] = ARTIFACT_PHASES[phase];
  const relativePath = `${directory}/${name}.md`;
  const created = copyTemplateIfMissing(workspace, templateName, relativePath);
  console.log(`${created ? 'created' : 'kept'} ${relativePath}`);
}

function main() {
  const [command, ...tokens] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printUsage();
    return;
  }
  switch (command) {
    case 'init':
      commandInit(tokens);
      return;
    case 'status':
      commandStatus(tokens);
      return;
    case 'advance':
      commandAdvance(tokens);
      return;
    case 'artifact':
      commandArtifact(tokens);
      return;
    case 'validate':
      commandValidate(tokens);
      return;
    case 'finalize':
      commandFinalize(tokens);
      return;
    default:
      throw new CliError(`Unknown command: ${command}`, EXIT.USAGE);
  }
}

try {
  main();
} catch (error) {
  if (error instanceof CliError) {
    console.error(`error: ${error.message}`);
    process.exit(error.exitCode);
  }
  console.error(`error: ${error.message}`);
  process.exit(EXIT.FILESYSTEM);
}
