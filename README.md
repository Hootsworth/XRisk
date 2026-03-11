# XRisk Engine

XRisk Engine is a standalone, open-source autonomous safety and control layer for LLM and agentic systems.

It is designed to run between an agent's intended action and the action executor. XRisk evaluates risk and policy context, then returns a clear decision:

- `allow`
- `confirm`
- `block`

The goal is practical safety for modern AI workflows: policy governance, prompt-injection resilience, privacy controls, capability boundaries, egress restrictions, and auditability.

## Why XRisk Exists

Agentic systems are useful but can fail in predictable ways:

- Over-privileged tool execution
- Prompt injection and context hijacking
- Secret and PII leakage
- Unsafe outbound network behavior
- Autonomy loops and repeated high-risk actions
- Poorly explainable safety decisions

XRisk provides composable guardrails to address these issues in one place.

## Core Features

- Policy-as-code with layered precedence (global, project, user)
- Weighted risk scoring with explainable breakdown
- Prompt-injection detection and anomaly scoring
- Sensitive data detection and redaction utilities
- Capability token sandboxing (scope, TTL, single-use)
- Network egress control (allowlist and denylist)
- Circuit breaker for repeated loops and risk escalation
- Tamper-evident audit trail (hash chain)
- Approval workflow integration for `confirm` actions
- Model output verification (consistency and evidence checks)
- Recovery and incident summary generation

## Project Structure

```text
xrisk-engine/
	bin/
		xrisk.js
	docs/
		openapi.yaml
	examples/
		action.json
		verify-model-input.json
		policies/
			baseline-policy-pack.json
	schemas/
		policy-pack.schema.json
		assess-result.schema.json
	src/
		adapters/
		compat/
		core/
		profiles/
		index.js
	tests/
		xrisk_engine_test.js
		security_regression_test.js
		scenario_matrix_test.js
```

## Installation

```bash
cd xrisk-engine
npm install
```

## Quick Start

Run all tests:

```bash
npm test
```

Run developer scenario matrix:

```bash
npm run test:matrix
```

## CLI Usage

XRisk ships with a CLI entrypoint:

```bash
node bin/xrisk.js <command> [flags]
```

### `assess`

Assess a proposed action and return an actionable decision payload.

```bash
node bin/xrisk.js assess --action-file examples/action.json --policies-file examples/policies/baseline-policy-pack.json --profile enterprise
```

You can also pipe JSON action payload via stdin:

```bash
echo '{"tool":"read_file","actorRole":"planner"}' | node bin/xrisk.js assess --profile developer
```

Supported flags:

- `--action-file <path>`
- `--payload-file <path>`
- `--prompt <text>`
- `--egress-url <url>`
- `--profile <developer|enterprise|high_security>`
- `--policies-file <path>`
- `--compact`

### `verify-model`

Validate model output consistency and evidence requirements:

```bash
node bin/xrisk.js verify-model --input-file examples/verify-model-input.json --profile enterprise
```

## Programmatic Usage

```js
import { createNodeXRisk } from './src/index.js';

const xrisk = createNodeXRisk({
	policies: {
		globalPolicies: [{ id: 'confirm-deploy', tool: 'deploy', effect: 'confirm', reason: 'approval required' }],
		projectPolicies: [{ id: 'block-power', tool: 'manage_power', effect: 'block', reason: 'blocked by default' }],
		userPolicies: []
	},
	egress: { allowedDomains: ['api.example.com'], deniedDomains: ['evil.example'] },
	telemetry: { enabled: true, localOnly: true }
});

const decision = xrisk.assess({
	action: { tool: 'deploy', actor: 'release-bot', actorRole: 'executor' },
	payload: { releaseId: '2026.03.10' },
	prompt: 'deploy release candidate',
	egressUrl: 'https://api.example.com/releases',
	approvalContext: { reason: 'release requested' }
});

console.log(decision.decision);
console.log(decision.reasons);
```

## How Decisions Are Made

At a high level, XRisk combines deterministic policy checks with risk signals:

1. Policy match across layered rule sets
2. Prompt-injection inspection
3. Sensitive data inspection
4. Role boundary enforcement
5. Capability token validation
6. Network egress evaluation
7. Risk score aggregation
8. Circuit breaker update
9. Audit logging and telemetry

The output is explainable and includes rationale fields (`reasons`, policy match details, risk breakdown, and incident summary when blocked).

## Policy Pack Schema

Use JSON policies validated by:

- `schemas/policy-pack.schema.json`

Example policy pack:

- `examples/policies/baseline-policy-pack.json`

Layer precedence is evaluated as global, then project, then user, with most restrictive matched effect winning (`block > confirm > allow`).

## API Contract

OpenAPI contract is available at:

- `docs/openapi.yaml`
- `docs/developer-adoption-guide.md`

Response schema for decisions:

- `schemas/assess-result.schema.json`

## Testing

Run core compatibility and engine tests:

```bash
npm run test:core
```

Run security regression tests:

```bash
npm run test:security
```

Run scenario matrix (real-world developer use cases):

```bash
npm run test:matrix
```

Run all suites:

```bash
npm test
```

CI workflow:

- `.github/workflows/ci.yml`

## Security Notes

- Prefer explicit policy packs for production usage.
- Keep telemetry local (`localOnly: true`) unless explicitly required.
- Rotate and revoke capability tokens frequently.
- Review denied/confirmed decisions in audit logs.
- Treat this project as a safety layer, not a substitute for infrastructure hardening.

## Compatibility Layer

`src/compat/` contains copied compatibility helpers from your existing Rex logic so migration can be incremental.

## License

Apache License 2.0.

See `LICENSE`.

## Contributing

Contributions are welcome.

Suggested workflow:

1. Fork and create a feature branch.
2. Add tests for behavior changes.
3. Run `npm test` before opening a PR.
4. Include rationale for policy/risk changes in the PR description.

## Roadmap

- HTTP server implementation for `docs/openapi.yaml`
- Additional language adapters
- Expanded threat-model and benchmark suite
