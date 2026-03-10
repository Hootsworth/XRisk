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
import { createIncidentSummary } from './recovery.js';

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

    assessAction(input = {}) {
        const action = input.action || {};
        const policy = this.policyEngine.evaluate(action);
        const dataProtection = detectSensitiveData(input.payload || action.args || {});
        const injection = inspectPromptInjection(input.prompt || '');
        const boundary = enforceAgentBoundary({ actorRole: action.actorRole || 'executor', action });

        const tokenCheck = input.capabilityToken
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
            anomaly: injection.score
        }, this.config.risk || {});

        const reasons = [];
        let decision = 'allow';

        const decisionCandidates = [policy.decision, injection.decision, boundary.decision, egress.decision, risk.decision === 'trip-circuit' ? 'block' : risk.decision];
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

        const breaker = this.circuitBreaker.record(action, { decision });
        if (breaker.tripped) {
            decision = 'block';
            reasons.push(`Circuit breaker tripped: ${breaker.reason}`);
        }

        if (input.capabilityToken && tokenCheck.valid) {
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
            breaker,
            simulation: simulateAction(action)
        };

        this.auditTrail.append({ type: 'assess_action', action, result });
        this.telemetry.track('assess_action', {
            decision,
            tool: action.tool,
            riskScore: risk.score,
            sensitiveFindings: dataProtection.findings.length
        });

        if (decision === 'confirm' && input.approvalContext) {
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
        this.auditTrail.append({ type: 'verify_model', verified });
        return verified;
    }

    getAuditStatus() {
        return this.auditTrail.verify();
    }
}
