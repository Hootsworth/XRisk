import crypto from 'crypto';

function hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
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

        const canonical = JSON.stringify(payload);
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

    verify() {
        let prev = 'GENESIS';
        for (const entry of this.entries) {
            const canonical = JSON.stringify({ timestamp: entry.timestamp, event: entry.event });
            const expected = hashValue(`${prev}:${canonical}`);
            if (entry.prevHash !== prev || entry.hash !== expected) {
                return { valid: false, brokenAt: entry.timestamp };
            }
            prev = entry.hash;
        }
        return { valid: true, count: this.entries.length };
    }
}
