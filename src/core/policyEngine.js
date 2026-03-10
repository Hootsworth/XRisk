function asArray(v) {
    return Array.isArray(v) ? v : [];
}

function wildcardMatch(value, pattern) {
    if (pattern === '*') return true;
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(value);
}

function ruleMatches(rule, action) {
    if (!rule || !action) return false;
    const toolOk = !rule.tool || wildcardMatch(action.tool || '', String(rule.tool));
    const actorOk = !rule.actor || wildcardMatch(action.actor || 'default', String(rule.actor));
    const scopeOk = !rule.scope || wildcardMatch(action.scope || 'default', String(rule.scope));
    return toolOk && actorOk && scopeOk;
}

export class PolicyEngine {
    constructor({ globalPolicies = [], projectPolicies = [], userPolicies = [] } = {}) {
        this.globalPolicies = asArray(globalPolicies);
        this.projectPolicies = asArray(projectPolicies);
        this.userPolicies = asArray(userPolicies);
    }

    evaluate(action = {}) {
        const layers = [
            { name: 'global', rules: this.globalPolicies },
            { name: 'project', rules: this.projectPolicies },
            { name: 'user', rules: this.userPolicies }
        ];

        const matched = [];
        for (const layer of layers) {
            for (const rule of layer.rules) {
                if (ruleMatches(rule, action)) {
                    matched.push({ ...rule, _layer: layer.name });
                }
            }
        }

        const priority = { allow: 1, confirm: 2, block: 3 };
        matched.sort((a, b) => (priority[b.effect] || 0) - (priority[a.effect] || 0));

        const top = matched[0] || null;
        if (!top) {
            return {
                decision: 'allow',
                reason: 'No matching policy rule.',
                rule: null,
                matched
            };
        }

        return {
            decision: top.effect,
            reason: top.reason || `Policy ${top.id || 'unnamed'} matched in ${top._layer} layer.`,
            rule: top,
            matched
        };
    }
}
