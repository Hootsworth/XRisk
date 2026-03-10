export class CircuitBreaker {
    constructor({ maxRepeatActions = 3, maxHighRiskActions = 5 } = {}) {
        this.maxRepeatActions = maxRepeatActions;
        this.maxHighRiskActions = maxHighRiskActions;
        this.lastActionKey = null;
        this.repeatCount = 0;
        this.highRiskCount = 0;
        this.open = false;
        this.reason = '';
    }

    record(action = {}, decision = {}) {
        if (this.open) {
            return { tripped: true, reason: this.reason };
        }

        const key = `${action.tool || 'unknown'}:${JSON.stringify(action.args || {})}`;
        if (key === this.lastActionKey) this.repeatCount += 1;
        else this.repeatCount = 1;
        this.lastActionKey = key;

        if (decision.decision === 'block' || decision.decision === 'confirm') {
            this.highRiskCount += 1;
        }

        if (this.repeatCount >= this.maxRepeatActions) {
            this.open = true;
            this.reason = 'Loop detected: repeated action with no state change.';
        } else if (this.highRiskCount >= this.maxHighRiskActions) {
            this.open = true;
            this.reason = 'Too many high-risk actions in this session.';
        }

        return {
            tripped: this.open,
            reason: this.reason || null,
            repeatCount: this.repeatCount,
            highRiskCount: this.highRiskCount
        };
    }

    reset() {
        this.open = false;
        this.reason = '';
        this.repeatCount = 0;
        this.highRiskCount = 0;
        this.lastActionKey = null;
    }
}
