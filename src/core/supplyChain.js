const RISKY_PACKAGES = new Set([
    'event-stream',
    'crossenv',
    'requestify'
]);

const PROVENANCE_ORDER = {
    none: 0,
    slsa0: 0,
    slsa1: 1,
    slsa2: 2,
    slsa3: 3,
    slsa4: 4
};

function normalizeLevel(level) {
    return String(level || 'none').toLowerCase();
}

function scoreFindingSeverity(finding) {
    if (finding.severity === 'critical') return 4;
    if (finding.severity === 'high') return 3;
    if (finding.severity === 'medium') return 2;
    return 1;
}

export function assessDependencyRisk(dependencies = {}, options = {}, artifacts = {}) {
    const findings = [];
    const requireSignatures = options.requireSignatures !== false;
    const minimumProvenance = normalizeLevel(options.minimumProvenance || 'slsa2');
    const signatures = artifacts.signatures || {};
    const provenance = artifacts.provenance || {};

    for (const [name, version] of Object.entries(dependencies)) {
        if (RISKY_PACKAGES.has(name)) {
            findings.push({ name, version, severity: 'high', reason: 'Known high-risk package marker.' });
        }
        if (String(version).includes('latest') || String(version).includes('*')) {
            findings.push({ name, version, severity: 'medium', reason: 'Non-pinned version increases supply-chain risk.' });
        }

        if (requireSignatures && signatures[name] !== true) {
            findings.push({ name, version, severity: 'critical', reason: 'Missing trusted artifact signature.' });
        }

        const actualLevel = normalizeLevel(provenance[name] || 'none');
        if ((PROVENANCE_ORDER[actualLevel] || 0) < (PROVENANCE_ORDER[minimumProvenance] || 0)) {
            findings.push({
                name,
                version,
                severity: 'high',
                reason: `Provenance level '${actualLevel}' below required '${minimumProvenance}'.`
            });
        }
    }

    const maxSeverity = findings.reduce((acc, finding) => Math.max(acc, scoreFindingSeverity(finding)), 0);
    const high = findings.filter((f) => f.severity === 'high').length;
    const medium = findings.filter((f) => f.severity === 'medium').length;

    let decision = 'allow';
    if (maxSeverity >= 4) decision = 'block';
    else if (high > 0 || medium > 1) decision = 'confirm';

    return {
        decision,
        findings,
        controls: {
            requireSignatures,
            minimumProvenance
        }
    };
}
