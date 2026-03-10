export class NetworkEgressPolicy {
    constructor({ allowedDomains = [], deniedDomains = [] } = {}) {
        this.allowedDomains = new Set(allowedDomains.map((d) => String(d).toLowerCase()));
        this.deniedDomains = new Set(deniedDomains.map((d) => String(d).toLowerCase()));
    }

    assess(urlString) {
        try {
            const url = new URL(urlString);
            const host = url.hostname.toLowerCase();

            if (this.deniedDomains.has(host)) {
                return { decision: 'block', reason: `Host denied: ${host}` };
            }

            if (this.allowedDomains.size > 0 && !this.allowedDomains.has(host)) {
                return { decision: 'confirm', reason: `Host not in allowlist: ${host}` };
            }

            return { decision: 'allow', reason: 'Host allowed by policy.' };
        } catch {
            return { decision: 'block', reason: 'Invalid URL for network egress.' };
        }
    }
}
