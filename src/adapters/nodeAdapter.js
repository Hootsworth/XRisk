import { XRiskEngine } from '../core/decisionEngine.js';
import { PolicyEngine } from '../core/policyEngine.js';

export function createNodeXRisk(config = {}) {
    const engine = new XRiskEngine(config);

    return {
        assess: (input) => engine.assessAction(input),
        verifyModelResponse: (payload) => engine.verifyModelResponse(payload),
        validatePolicies: (policyPack, options) => PolicyEngine.verifyPolicyPack(policyPack, options),
        replayDecision: (auditHash) => engine.replayDecision(auditHash),
        getAuditEntries: () => engine.getAuditEntries(),
        getAuditStatus: () => engine.getAuditStatus(),
        engine
    };
}
