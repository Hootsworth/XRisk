import { redactObjectSensitiveData } from './dataProtection.js';

export class PrivacyTelemetry {
    constructor({ enabled = false, localOnly = true } = {}) {
        this.enabled = enabled;
        this.localOnly = localOnly;
        this.events = [];
    }

    track(eventName, payload = {}) {
        if (!this.enabled) return { tracked: false, reason: 'telemetry_disabled' };

        const sanitized = redactObjectSensitiveData(payload);
        const event = {
            ts: Date.now(),
            eventName,
            localOnly: this.localOnly,
            payload: sanitized
        };
        this.events.push(event);
        return { tracked: true, event };
    }

    getSnapshot() {
        return {
            enabled: this.enabled,
            localOnly: this.localOnly,
            count: this.events.length,
            events: this.events.slice(-100)
        };
    }
}
