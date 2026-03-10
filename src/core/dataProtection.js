const SECRET_PATTERNS = [
    { type: 'api_key', regex: /(sk-[a-z0-9]{20,})/gi },
    { type: 'aws_access_key', regex: /(AKIA[0-9A-Z]{16})/g },
    { type: 'private_key', regex: /-----BEGIN (RSA|EC|OPENSSH|DSA)? ?PRIVATE KEY-----/g },
    { type: 'email', regex: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi },
    { type: 'credit_card', regex: /(?<!\.)\b(?:\d[ -]?){13,19}\b(?!\.)/g }
];

export function detectSensitiveData(payload) {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const findings = [];

    for (const pat of SECRET_PATTERNS) {
        const matches = text.match(pat.regex);
        if (matches && matches.length) {
            findings.push({ type: pat.type, count: matches.length });
        }
    }

    const sensitivityScore = Math.min(1, findings.reduce((acc, f) => acc + Math.min(0.3, f.count * 0.1), 0));
    return {
        findings,
        sensitivityScore,
        hasSensitiveData: findings.length > 0
    };
}

export function redactSensitiveData(payload) {
    let text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    for (const pat of SECRET_PATTERNS) {
        text = text.replace(pat.regex, `[REDACTED:${pat.type}]`);
    }
    return text;
}

export function redactObjectSensitiveData(value) {
    if (typeof value === 'string') {
        return redactSensitiveData(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactObjectSensitiveData(item));
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = redactObjectSensitiveData(v);
        }
        return out;
    }
    return value;
}
