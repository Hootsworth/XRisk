export class ApprovalWorkflow {
    constructor({ requireSecondApprover = false } = {}) {
        this.requireSecondApprover = requireSecondApprover;
        this.pending = new Map();
    }

    request(approval) {
        const id = `apr_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        this.pending.set(id, {
            ...approval,
            id,
            createdAt: Date.now(),
            approvals: []
        });
        return { id, status: 'pending' };
    }

    approve(id, approver) {
        const req = this.pending.get(id);
        if (!req) return { ok: false, reason: 'not_found' };

        req.approvals.push({ approver, at: Date.now() });

        if (this.requireSecondApprover && req.approvals.length < 2) {
            return { ok: true, status: 'partially_approved', count: req.approvals.length };
        }

        this.pending.delete(id);
        return { ok: true, status: 'approved', approval: req };
    }
}
