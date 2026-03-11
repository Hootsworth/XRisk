# XRisk Developer Adoption Guide

This guide explains why XRisk is easy to adopt and gives a practical, step-by-step path from install to production rollout.

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
  }
});

const decision = xrisk.assess({
  action: { tool: 'deploy', actor: 'release-bot', actorRole: 'executor' },
  payload: { releaseId: '2026.03.11' },
  prompt: 'deploy release candidate',
  egressUrl: 'https://api.example.com/releases',
  approvalContext: { reason: 'release requested' }
});

if (decision.decision === 'block') {
  throw new Error(`Blocked by XRisk: ${decision.reasons.join('; ')}`);
}

if (decision.decision === 'confirm') {
  // Send to your approval workflow and pause execution.
}

// allow: continue with tool execution.
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
- [ ] Selected profile (`developer`, `enterprise`, or `high_security`).
- [ ] Established initial policy pack.
- [ ] Added runtime `assess()` gate before tool execution.
- [ ] Connected `confirm` decisions to approval workflow.
- [ ] Enabled audit/telemetry review process.
- [ ] Completed staged rollout to enforcement mode.

## Related References

- `README.md`
- `docs/openapi.yaml`
- `examples/policies/baseline-policy-pack.json`
- `schemas/policy-pack.schema.json`
- `schemas/assess-result.schema.json`
