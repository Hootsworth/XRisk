const INJECTION_PATTERNS = [
    /ignore\s+(all|previous|prior)\s+instructions/i,
    /reveal\s+(system|hidden)\s+prompt/i,
    /act\s+as\s+.*unrestricted/i,
    /bypass\s+(safety|policy|guardrails)/i,
    /developer\s+mode\s+enabled/i,
    /do\s+not\s+follow\s+your\s+rules/i
];

export function inspectPromptInjection(text) {
    const raw = String(text || '');
    const indicators = INJECTION_PATTERNS.filter((rx) => rx.test(raw)).map((rx) => rx.source);
    const score = Math.min(1, indicators.length * 0.28);

    return {
        suspected: score >= 0.28,
        score,
        indicators,
        decision: score >= 0.56 ? 'block' : score >= 0.28 ? 'confirm' : 'allow'
    };
}
