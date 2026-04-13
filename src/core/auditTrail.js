import crypto from 'crypto';

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonicalStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

export class AuditTrail {
    constructor() {
        this.entries = [];
        this.lastHash = 'GENESIS';
    }

    append(event) {
        // Snapshot event payload at append-time so later mutations cannot break hash verification.
        const eventSnapshot = JSON.parse(JSON.stringify(event || {}));
        const payload = {
            timestamp: new Date().toISOString(),
            event: eventSnapshot
        };

        const canonical = canonicalStringify(payload);
        const entryHash = hashValue(`${this.lastHash}:${canonical}`);
        const entry = {
            ...payload,
            prevHash: this.lastHash,
            hash: entryHash
        };

        this.entries.push(entry);
        this.lastHash = entryHash;
        return entry;
    }

    getEntries() {
        return this.entries.slice();
    }

    findByHash(hash) {
        return this.entries.find((entry) => entry.hash === hash) || null;
    }

    verify() {
        let prev = 'GENESIS';
        for (const entry of this.entries) {
            const canonical = canonicalStringify({ timestamp: entry.timestamp, event: entry.event });
            const expected = hashValue(`${prev}:${canonical}`);
            if (entry.prevHash !== prev || entry.hash !== expected) {
                return { valid: false, brokenAt: entry.timestamp };
            }
            prev = entry.hash;
        }
        return { valid: true, count: this.entries.length };
    }
}
