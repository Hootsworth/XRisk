export function buildRecoveryPlan({ incidentType, action }) {
    if (incidentType === 'loop') {
        return [
            'Stop repeating the same action.',
            'Collect current state snapshot.',
            'Switch to alternate strategy.',
            'Request human checkpoint if still failing.'
        ];
    }

    if (incidentType === 'exfiltration') {
        return [
            'Block outbound channel immediately.',
            'Rotate potentially exposed secrets.',
            'Audit recent prompts and tool calls.',
            'Resume with strict egress policy.'
        ];
    }

    return [
        `Review incident around tool ${action?.tool || 'unknown'}.`,
        'Pause autonomous execution.',
        'Request explicit user approval to continue.'
    ];
}

export function createIncidentSummary(context = {}) {
    return {
        timestamp: new Date().toISOString(),
        severity: context.severity || 'medium',
        incidentType: context.incidentType || 'unspecified',
        action: context.action || null,
        decision: context.decision || null,
        nextSteps: buildRecoveryPlan(context)
    };
}
