function stableStringify(v) {
    return JSON.stringify(v, Object.keys(v || {}).sort());
}

export function verifyModelOutput({ primary, secondary = [], requireEvidence = false }) {
    const normalizedPrimary = stableStringify(primary || {});
    const normalizedSecondary = secondary.map((s) => stableStringify(s || {}));

    const consistencyHits = normalizedSecondary.filter((s) => s === normalizedPrimary).length;
    const consistency = secondary.length ? consistencyHits / secondary.length : 1;

    const hasEvidence = Boolean(primary?.evidence && primary.evidence.length);
    const decision = requireEvidence && !hasEvidence
        ? 'confirm'
        : consistency < 0.34
            ? 'confirm'
            : 'allow';

    return {
        decision,
        consistency,
        hasEvidence,
        reason: decision === 'allow' ? 'Model output passed verification checks.' : 'Model output requires human review.'
    };
}
