const RISKY_PACKAGES = new Set([
    'event-stream',
    'crossenv',
    'requestify'
]);

export function assessDependencyRisk(dependencies = {}) {
    const findings = [];

    for (const [name, version] of Object.entries(dependencies)) {
        if (RISKY_PACKAGES.has(name)) {
            findings.push({ name, version, severity: 'high', reason: 'Known high-risk package marker.' });
        }
        if (String(version).includes('latest') || String(version).includes('*')) {
            findings.push({ name, version, severity: 'medium', reason: 'Non-pinned version increases supply-chain risk.' });
        }
    }

    const high = findings.filter((f) => f.severity === 'high').length;
    return {
        decision: high > 0 ? 'confirm' : 'allow',
        findings
    };
}
