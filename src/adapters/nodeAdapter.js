import { XRiskEngine } from '../core/decisionEngine.js';

export function createNodeXRisk(config = {}) {
    const engine = new XRiskEngine(config);

    return {
        assess: (input) => engine.assessAction(input),
        verifyModelResponse: (payload) => engine.verifyModelResponse(payload),
        getAuditStatus: () => engine.getAuditStatus(),
        engine
    };
}
