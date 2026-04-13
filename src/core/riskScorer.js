const DEFAULT_WEIGHTS = {
    intent: 0.2,
    action: 0.25,
    dataSensitivity: 0.2,
    environment: 0.15,
    anomaly: 0.2,
    supplyChain: 0
};

function normalize(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

export function scoreRisk(signals = {}, config = {}) {
    const weights = { ...DEFAULT_WEIGHTS, ...(config.weights || {}) };
    const parts = {
        intent: normalize(signals.intent),
        action: normalize(signals.action),
        dataSensitivity: normalize(signals.dataSensitivity),
        environment: normalize(signals.environment),
        anomaly: normalize(signals.anomaly),
        supplyChain: normalize(signals.supplyChain)
    };

    const total =
        parts.intent * weights.intent +
        parts.action * weights.action +
        parts.dataSensitivity * weights.dataSensitivity +
        parts.environment * weights.environment +
        parts.anomaly * weights.anomaly +
        parts.supplyChain * weights.supplyChain;

    const score = Math.max(0, Math.min(1, total));
    const thresholds = config.thresholds || {
        allow: 0.35,
        confirm: 0.65,
        block: 0.85,
        tripCircuit: 0.95
    };

    let decision = 'allow';
    if (score >= thresholds.tripCircuit) decision = 'trip-circuit';
    else if (score >= thresholds.block) decision = 'block';
    else if (score >= thresholds.confirm) decision = 'confirm';

    return {
        score,
        decision,
        breakdown: parts,
        thresholds
    };
}
