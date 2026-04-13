import { PolicyEngine } from './policyEngine.js';
import { scoreRisk } from './riskScorer.js';
import { detectSensitiveData } from './dataProtection.js';
import { inspectPromptInjection } from './injectionFirewall.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { AuditTrail } from './auditTrail.js';
import { PrivacyTelemetry } from './privacyTelemetry.js';
import { NetworkEgressPolicy } from './networkEgress.js';
import { validateCapabilityToken, consumeCapabilityToken } from './sandbox.js';
import { simulateAction } from './simulation.js';
import { ApprovalWorkflow } from './approvalWorkflow.js';
import { verifyModelOutput } from './modelVerifier.js';
import { enforceAgentBoundary } from './agentCoordinator.js';
import { assessDependencyRisk } from './supplyChain.js';
import { buildReplayResult, createIncidentSummary, hashDecisionSnapshot } from './recovery.js';

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function compactFindings(findings = []) {
    return findings.map((f) => ({ name: f.name, severity: f.severity, reason: f.reason }));
}

export class XRiskEngine {
    constructor(config = {}) {
        this.config = config;
        this.policyEngine = new PolicyEngine(config.policies || {});
        this.circuitBreaker = new CircuitBreaker(config.circuitBreaker || {});
        this.auditTrail = new AuditTrail();
        this.telemetry = new PrivacyTelemetry(config.telemetry || {});
        this.egressPolicy = new NetworkEgressPolicy(config.egress || {});
        this.approvalWorkflow = new ApprovalWorkflow(config.approvals || {});
    }

    buildAssessmentHashes(input, result, policy) {
        const policySnapshot = {
            decision: policy.decision,
            matched: (policy.matched || []).map((rule) => ({
                id: rule.id || null,
                effect: rule.effect,
                tool: rule.tool || '*',
                actor: rule.actor || '*',
                scope: rule.scope || '*',
                layer: rule._layer || null
            }))
        };

        const inputSnapshot = {
            action: input.action || {},
            payload: input.payload || {},
            prompt: input.prompt || '',
            egressUrl: input.egressUrl || null,
            intentRisk: input.intentRisk || 0,
            actionRisk: input.actionRisk || 0,
            environmentRisk: input.environmentRisk || 0,
            supplyChain: input.supplyChain || null
        };

        const decisionSnapshot = {
            decision: result.decision,
            policyDecision: result.policy.decision,
            riskDecision: result.risk.decision,
            riskScore: Number(result.risk.score.toFixed(6)),
            injectionDecision: result.injection.decision,
            boundaryDecision: result.boundary.decision,
            egressDecision: result.egress.decision,
            supplyChainDecision: result.supplyChain.decision,
            supplyChainFindings: compactFindings(result.supplyChain.findings || []),
            breakerTripped: Boolean(result.breaker?.tripped)
        };

        return {
            inputHash: hashDecisionSnapshot(inputSnapshot),
            policyHash: hashDecisionSnapshot(policySnapshot),
            decisionHash: hashDecisionSnapshot(decisionSnapshot),
            modelVerificationHash: null,
            snapshot: decisionSnapshot
        };
    }

    assessAction(input = {}, options = {}) {
        const replayMode = Boolean(options.replayMode);
        const action = input.action || {};
        const policy = this.policyEngine.evaluate(action);
        const dataProtection = detectSensitiveData(input.payload || action.args || {});
        const injection = inspectPromptInjection(input.prompt || '');
        const boundary = enforceAgentBoundary({ actorRole: action.actorRole || 'executor', action });
        const supplyChainInput = input.supplyChain || null;
        const supplyChain = supplyChainInput
            ? assessDependencyRisk(supplyChainInput.dependencies || {}, this.config.supplyChain || {}, supplyChainInput.artifacts || {})
            : { decision: 'allow', findings: [], controls: this.config.supplyChain || {} };

        const tokenCheck = replayMode
            ? { valid: true }
            : input.capabilityToken
            ? validateCapabilityToken(input.capabilityToken, action)
            : { valid: true };

        let egress = { decision: 'allow', reason: 'No network egress target.' };
        if (input.egressUrl) {
            egress = this.egressPolicy.assess(input.egressUrl);
        }

        const risk = scoreRisk({
            intent: input.intentRisk || 0.2,
            action: input.actionRisk || (policy.decision === 'block' ? 0.95 : 0.4),
            dataSensitivity: dataProtection.sensitivityScore,
            environment: input.environmentRisk || 0.3,
            anomaly: injection.score,
            supplyChain: supplyChain.decision === 'block' ? 1 : supplyChain.decision === 'confirm' ? 0.7 : 0
        }, this.config.risk || {});

        const reasons = [];
        let decision = 'allow';

        const decisionCandidates = [
            policy.decision,
            injection.decision,
            boundary.decision,
            egress.decision,
            supplyChain.decision,
            risk.decision === 'trip-circuit' ? 'block' : risk.decision
        ];
        if (!tokenCheck.valid) {
            decisionCandidates.push('block');
            reasons.push(`Capability token invalid: ${tokenCheck.reason}`);
        }

        if (decisionCandidates.includes('block')) decision = 'block';
        else if (decisionCandidates.includes('confirm')) decision = 'confirm';

        if (policy.reason) reasons.push(policy.reason);
        if (injection.indicators.length) reasons.push('Prompt injection indicators detected.');
        if (dataProtection.hasSensitiveData) reasons.push('Sensitive data detected in payload.');
        if (boundary.decision === 'block') reasons.push(boundary.reason);
        if (egress.reason) reasons.push(egress.reason);
        if (supplyChain.findings.length) reasons.push('Supply-chain risk findings detected.');

        const breaker = replayMode
            ? { tripped: false, reason: null, repeatCount: 0, highRiskCount: 0 }
            : this.circuitBreaker.record(action, { decision });
        if (breaker.tripped) {
            decision = 'block';
            reasons.push(`Circuit breaker tripped: ${breaker.reason}`);
        }

        if (!replayMode && input.capabilityToken && tokenCheck.valid) {
            consumeCapabilityToken(input.capabilityToken);
        }

        const result = {
            decision,
            reasons,
            policy,
            risk,
            dataProtection,
            injection,
            boundary,
            egress,
            supplyChain,
            breaker,
            simulation: simulateAction(action)
        };

        result.forensics = this.buildAssessmentHashes(input, result, policy);

        if (!replayMode) {
            this.auditTrail.append({
                type: 'assess_action',
                action,
                inputSnapshot: cloneJson(input),
                resultSnapshot: {
                    decision: result.decision,
                    decisionHash: result.forensics.decisionHash
                },
                forensics: result.forensics
            });
            this.telemetry.track('assess_action', {
                decision,
                tool: action.tool,
                riskScore: risk.score,
                sensitiveFindings: dataProtection.findings.length,
                supplyChainFindings: supplyChain.findings.length
            });
        }

        if (!replayMode && decision === 'confirm' && input.approvalContext) {
            result.approvalRequest = this.approvalWorkflow.request(input.approvalContext);
        }

        if (decision === 'block') {
            result.incident = createIncidentSummary({
                incidentType: breaker.tripped ? 'loop' : 'policy_block',
                action,
                decision,
                severity: risk.score > 0.85 ? 'high' : 'medium'
            });
        }

        return result;
    }

    verifyModelResponse(responsePayload) {
        const verified = verifyModelOutput(responsePayload);
        const modelVerificationHash = hashDecisionSnapshot({
            decision: verified.decision,
            consistency: Number((verified.consistency || 0).toFixed(6)),
            hasEvidence: Boolean(verified.hasEvidence),
            reason: verified.reason
        });
        verified.forensics = { modelVerificationHash };
        this.auditTrail.append({
            type: 'verify_model',
            inputSnapshot: cloneJson(responsePayload),
            verified: cloneJson(verified),
            modelVerificationHash
        });
        return verified;
    }

    getAuditEntries() {
        return this.auditTrail.getEntries();
    }

    replayDecision(auditHash) {
        const entry = this.auditTrail.findByHash(auditHash);
        if (!entry) {
            return { ok: false, reason: 'audit_entry_not_found' };
        }

        const event = entry.event || {};
        if (event.type === 'assess_action') {
            const replayed = this.assessAction(event.inputSnapshot || {}, { replayMode: true });
            const expectedHash = event.resultSnapshot?.decisionHash || null;
            const actualHash = replayed.forensics?.decisionHash || null;
            const replay = buildReplayResult({
                expected: event.resultSnapshot?.decision || null,
                actual: replayed.decision,
                hashMatch: expectedHash !== null && expectedHash === actualHash
            });

            return {
                ok: true,
                type: 'assess_action',
                replay,
                expectedHash,
                actualHash,
                decision: replayed.decision
            };
        }

        if (event.type === 'verify_model') {
            const replayed = verifyModelOutput(event.inputSnapshot || {});
            const replayHash = hashDecisionSnapshot({
                decision: replayed.decision,
                consistency: Number((replayed.consistency || 0).toFixed(6)),
                hasEvidence: Boolean(replayed.hasEvidence),
                reason: replayed.reason
            });

            return {
                ok: true,
                type: 'verify_model',
                replay: buildReplayResult({
                    expected: event.verified?.decision || null,
                    actual: replayed.decision,
                    hashMatch: replayHash === event.modelVerificationHash
                }),
                expectedHash: event.modelVerificationHash || null,
                actualHash: replayHash
            };
        }

        return { ok: false, reason: 'unsupported_event_type' };
    }

    getAuditStatus() {
        return this.auditTrail.verify();
    }
}
