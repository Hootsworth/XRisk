# XRisk Developer Adoption Guide

This guide explains why XRisk is easy to adopt and gives a practical, step-by-step path from install to production rollout.

## Current Implementation Status

- Phase 1 is implemented: policy verification, supply-chain integrity checks, and deterministic forensics/replay are available now.
- Phase 2 and Phase 3 remain roadmap items.

## Why XRisk Is Easy To Adopt

- Single package and CLI: no large platform setup required.
- Works as a thin safety layer: place it between agent intent and tool execution.
- Policy-as-code: versionable JSON rules instead of hardcoded logic.
- Incremental rollout: start with `allow/confirm`, tighten to `block` over time.
- Programmatic and CLI usage: fits local testing, CI pipelines, and runtime integration.
- Built-in explainability: decisions include reasons and risk breakdowns.

## Adoption Path At A Glance

1. Install and run baseline tests.
2. Evaluate one real action with the CLI.
3. Start with a baseline policy pack.
4. Integrate `assess()` into your action execution path.
5. Route `confirm` decisions to your approval flow.
6. Observe logs/telemetry and tune policy thresholds.
7. Enforce stricter controls for production.

## Step 1: Install And Validate

```bash
cd xrisk-engine
npm install
npm test
```

What this gives you:

- A verified local environment.
- Confidence that core, security, and matrix scenarios pass before integration.

## Step 2: Run Your First Safety Check (CLI)

Use the example payload and policy pack:

```bash
node bin/xrisk.js assess --action-file examples/action.json --policies-file examples/policies/baseline-policy-pack.json --profile enterprise
```

You can also validate model-output checks:

```bash
node bin/xrisk.js verify-model --input-file examples/verify-model-input.json --profile enterprise
```

Validate policy safety before rollout:

```bash
node bin/xrisk.js validate-policies --policies-file examples/policies/baseline-policy-pack.json
```

Expected output pattern:

- `decision`: `allow`, `confirm`, or `block`
- `reasons`: human-readable rationale
- risk and policy match details for debugging and audits

## Step 3: Choose A Starting Profile

XRisk includes ready-to-use profiles:

- `developer`: low-friction local development
- `enterprise`: balanced default for team environments
- `high_security`: strict posture for sensitive workflows

Start with `enterprise` for most teams, then tune from observed behavior.

## Step 4: Adopt Policy-As-Code

Use `examples/policies/baseline-policy-pack.json` as your first policy pack and customize it for your tool surface.

Policy precedence is:

1. global
2. project
3. user

Most restrictive matched effect wins (`block > confirm > allow`).

Validation schema:

- `schemas/policy-pack.schema.json`

Policy verification behavior (implemented):

- Flags overlapping rules with conflicting effects.
- Flags shadowed/dead rules.
- Fails on allow-overrides for critical tool classes (for example `run_shell`, `deploy`, `manage_power`).

## Step 5: Integrate In Your Runtime (Programmatic)

Minimal Node integration:

```js
import { createNodeXRisk } from './src/index.js';

const xrisk = createNodeXRisk({
  policies: {
    globalPolicies: [],
    projectPolicies: [],
    userPolicies: []
  },
  egress: {
    allowedDomains: ['api.example.com'],
    deniedDomains: []
  },
  telemetry: {
    enabled: true,
    localOnly: true
  },
  supplyChain: {
    requireSignatures: true,
    minimumProvenance: 'slsa2'
  }
});

const decision = xrisk.assess({
  action: { tool: 'deploy', actor: 'release-bot', actorRole: 'executor' },
  payload: { releaseId: '2026.03.11' },
  prompt: 'deploy release candidate',
  egressUrl: 'https://api.example.com/releases',
  approvalContext: { reason: 'release requested' },
  supplyChain: {
    dependencies: {
      mylib: '1.2.3'
    },
    artifacts: {
      signatures: {
        mylib: true
      },
      provenance: {
        mylib: 'slsa3'
      }
    }
  }
});

if (decision.decision === 'block') {
  throw new Error(`Blocked by XRisk: ${decision.reasons.join('; ')}`);
}

if (decision.decision === 'confirm') {
  // Send to your approval workflow and pause execution.
}

// Forensics metadata is always attached for deterministic replay.
console.log(decision.forensics);

// allow: continue with tool execution.
```

Programmatic Phase 1 helpers:

```js
const verification = xrisk.validatePolicies(policyPack, {
  criticalTools: ['run_shell', 'deploy', 'manage_power']
});

const entries = xrisk.getAuditEntries();
const latestAssess = [...entries].reverse().find((entry) => entry.event?.type === 'assess_action');
if (latestAssess) {
  const replay = xrisk.replayDecision(latestAssess.hash);
  console.log(replay);
}
```

Integration pattern:

1. Agent proposes action.
2. Call `xrisk.assess(...)`.
3. Branch on `allow/confirm/block`.
4. Log decision metadata.
5. Execute only approved actions.

## Step 6: Roll Out Gradually

Use a staged adoption model to reduce disruption:

1. Shadow mode: log decisions, do not block yet.
2. Confirm mode: require approvals on medium-risk actions.
3. Enforcement mode: block high-risk actions by policy.

Recommended rollout order:

- Start with risky tools (deploy, network, data export, secrets access).
- Add egress restrictions (`allowedDomains`, `deniedDomains`).
- Tighten profile and policy thresholds after observing false positives.

## Step 7: Operationalize

Make XRisk part of your delivery process:

- CI checks: run `npm test` and policy validation before release.
- Audit and incident review: inspect block/confirm trends.
- Policy versioning: track policy changes in Git with PR review.
- Recovery readiness: use incident summaries to speed investigations.

Recommended CI gate commands:

```bash
npm test
node bin/xrisk.js validate-policies --policies-file examples/policies/baseline-policy-pack.json
```

## Common Adoption Scenarios

- New agent project: use `enterprise` profile + baseline policy pack on day one.
- Migrating an existing toolchain: integrate around your highest-risk actions first.
- Regulated environment: start with `high_security`, then selectively relax where justified.

## Time-To-Value Expectations

Typical onboarding timeline for a team already using Node:

- 15-30 minutes: local install, tests, first CLI assessment.
- 0.5-1 day: integrate `assess()` into one critical workflow.
- 1-3 days: policy tuning and approval-path integration for production readiness.

## Adoption Checklist

- [ ] Installed dependencies and executed tests.
- [ ] Ran `assess` and `verify-model` with real sample data.
- [ ] Ran `validate-policies` and resolved critical verification findings.
- [ ] Selected profile (`developer`, `enterprise`, or `high_security`).
- [ ] Established initial policy pack.
- [ ] Added runtime `assess()` gate before tool execution.
- [ ] Enabled supply-chain signature/provenance checks for production actions.
- [ ] Connected `confirm` decisions to approval workflow.
- [ ] Enabled audit/telemetry review process.
- [ ] Verified deterministic replay for at least one critical decision path.
- [ ] Completed staged rollout to enforcement mode.

## Related References

- `README.md`
- `docs/openapi.yaml`
- `examples/policies/baseline-policy-pack.json`
- `schemas/policy-pack.schema.json`
- `schemas/assess-result.schema.json`

## Major Security Roadmap (High-Impact Additions)

This roadmap prioritizes security capabilities that materially improve breach resistance, containment speed, and auditability. It excludes low-impact UX-only enhancements.

Phase status:

- Phase 1: implemented.
- Phase 2: planned.
- Phase 3: planned.

### Phase 1 (0-8 Weeks): Assurance And Immediate Risk Reduction

Status: implemented.

1. Formal Policy Verification And Conflict Analysis

- Why it matters: prevents silent policy gaps and contradictory rule sets in production.
- Module mapping:
  - Extend `src/core/policyEngine.js` with a policy graph builder and static checks.
  - Add policy validation CLI entry points in `bin/xrisk.js`.
  - Add schema extensions in `schemas/policy-pack.schema.json` for verification constraints.
- Deliverables:
  - `xrisk validate-policies` command that fails on contradictions, dead rules, and allow-overrides on critical controls.
  - Verification report artifacts for CI.
- Security uplift: high.
- Complexity: medium.

2. Supply Chain Integrity Enforcement (Signed Artifacts + Provenance)

- Why it matters: blocks tampered dependencies/models before runtime.
- Module mapping:
  - Expand `src/core/supplyChain.js` to enforce signature/provenance checks.
  - Feed risk penalties into `src/core/riskScorer.js`.
  - Emit signed-verification evidence through `src/core/auditTrail.js`.
- Deliverables:
  - Verification gates for package/model signatures and SBOM/provenance minimums.
  - Policy controls for strict vs permissive supply-chain posture.
- Security uplift: very high.
- Complexity: medium-high.

3. Deterministic Forensics And Replay

- Why it matters: enables evidence-quality incident reconstruction and root-cause analysis.
- Module mapping:
  - Extend `src/core/auditTrail.js` for hash-linked decision snapshots.
  - Add replay helpers in `src/core/recovery.js`.
  - Add result metadata alignment with `schemas/assess-result.schema.json`.
- Deliverables:
  - Immutable decision record format (policy hash, input hash, decision path, model verification hash).
  - Replay API that reproduces allow/confirm/block outcomes.
- Security uplift: high.
- Complexity: medium.

### Phase 2 (2-4 Months): Active Defense And Blast-Radius Control

1. Real-Time Threat Intelligence Correlation

- Why it matters: converts static policy decisions into adaptive, attack-aware decisions.
- Module mapping:
  - Introduce threat intel adapter flows via `src/adapters/nodeAdapter.js`.
  - Correlate indicators in `src/core/decisionEngine.js`.
  - Add dynamic penalties and confidence boosts in `src/core/riskScorer.js`.
- Deliverables:
  - Ingestion pipeline for CVE/IOC feeds and internal SOC indicators.
  - Time-decayed risk boosts for active threats.
- Security uplift: very high.
- Complexity: high.

2. Zero-Trust Workload Identity + Action Authorization

- Why it matters: dramatically reduces lateral movement and identity replay risk.
- Module mapping:
  - Add signed actor/workload claim checks to `src/core/modelVerifier.js` and `src/core/decisionEngine.js`.
  - Enforce short-lived authorization constraints in `src/compat/commandPolicy.js`.
  - Track identity evidence in `src/core/auditTrail.js`.
- Deliverables:
  - Action evaluation requires verifiable workload identity and policy-bound claims.
  - Strict failure behavior when identity proof is missing/expired.
- Security uplift: very high.
- Complexity: high.

3. Autonomous Containment Orchestration

- Why it matters: cuts mean-time-to-containment from human-speed to system-speed.
- Module mapping:
  - Implement response playbooks in `src/core/recovery.js`.
  - Trigger circuit breaking and isolation in `src/core/circuitBreaker.js` and `src/core/sandbox.js`.
  - Clamp outbound channels in `src/core/networkEgress.js`.
- Deliverables:
  - Policy-bound response actions: isolate session, revoke tokens, disable tool classes, lock egress.
  - Incident severity ladder that escalates controls automatically.
- Security uplift: very high.
- Complexity: high.

### Phase 3 (4-8 Months): Advanced Governance And Resilience At Scale

1. Adversarial Simulation Harness (Continuous Red-Team)

- Why it matters: proactively discovers bypasses before production exploitation.
- Module mapping:
  - Expand `src/core/simulation.js` with fuzzing/mutation strategies.
  - Integrate prompt/data exfil attack families in `src/core/injectionFirewall.js` and `src/core/dataProtection.js`.
  - Run regression suites in `tests/security_regression_test.js` and `tests/scenario_matrix_test.js`.
- Deliverables:
  - Continuous adversarial test pack in CI.
  - Security quality gates based on bypass-rate and containment-time thresholds.
- Security uplift: high.
- Complexity: high.

2. Multi-Party Approval With Cryptographic Decision Sealing

- Why it matters: provides non-repudiation and hardened governance for critical actions.
- Module mapping:
  - Extend `src/core/approvalWorkflow.js` for N-of-M approvals.
  - Add signature bundles and chain proofs in `src/core/auditTrail.js`.
  - Coordinate approval state transitions in `src/core/agentCoordinator.js`.
- Deliverables:
  - Threshold approval for sensitive actions.
  - Tamper-evident approval chain attached to final decisions.
- Security uplift: high.
- Complexity: medium-high.

3. Data Lineage + Purpose-Bound Enforcement

- Why it matters: prevents subtle data misuse that often bypasses simple DLP checks.
- Module mapping:
  - Add lineage tags and purpose metadata enforcement in `src/core/dataProtection.js`.
  - Include purpose-aware constraints in `src/core/policyEngine.js`.
  - Emit lineage trails via `src/core/privacyTelemetry.js`.
- Deliverables:
  - End-to-end data lineage graph per decision.
  - Policy blocks when purpose constraints are violated.
- Security uplift: high.
- Complexity: high.

### Prioritization Matrix

Implement in this order for maximum return on engineering effort:

1. Formal policy verification.
2. Supply-chain integrity enforcement.
3. Deterministic forensics/replay.
4. Real-time threat intel correlation.
5. Zero-trust identity authorization.
6. Autonomous containment orchestration.
7. Adversarial simulation harness.
8. Multi-party cryptographic approval.
9. Data lineage and purpose-bound controls.

### CI/CD Gates To Add

Add these mandatory checks to materially raise security posture:

- Policy verification pass (`validate-policies`) with zero critical violations.
- Security regression pass (injection, exfiltration, bypass scenarios).
- Supply-chain verification pass (signature + provenance thresholds).
- Replay consistency pass (same input + policy hash => same decision hash).

### Success Metrics (Track Monthly)

- Mean time to containment for high-severity incidents.
- Percentage of critical decisions with complete cryptographic evidence.
- Policy conflict rate and drift rate between environments.
- Security regression bypass rate.
- False positive and false negative rates by risk tier.
