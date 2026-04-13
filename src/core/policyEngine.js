function asArray(v) {
    return Array.isArray(v) ? v : [];
}

const EFFECT_PRIORITY = { allow: 1, confirm: 2, block: 3 };
const DEFAULT_CRITICAL_TOOLS = ['run_shell', 'manage_power', 'deploy', 'secrets_access', 'data_export'];

function wildcardMatch(value, pattern) {
    if (pattern === '*') return true;
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(value);
}

function normalizePattern(pattern) {
    return String(pattern || '*');
}

function patternContains(supersetPattern, subsetPattern) {
    const superset = normalizePattern(supersetPattern);
    const subset = normalizePattern(subsetPattern);
    if (superset === '*') return true;
    if (subset === '*') return false;
    return superset.toLowerCase() === subset.toLowerCase();
}

function patternsIntersect(left, right) {
    const a = normalizePattern(left);
    const b = normalizePattern(right);
    if (a === '*' || b === '*') return true;
    return a.toLowerCase() === b.toLowerCase();
}

function ruleContains(a, b) {
    return (
        patternContains(a.tool, b.tool) &&
        patternContains(a.actor, b.actor) &&
        patternContains(a.scope, b.scope)
    );
}

function rulesIntersect(a, b) {
    return (
        patternsIntersect(a.tool, b.tool) &&
        patternsIntersect(a.actor, b.actor) &&
        patternsIntersect(a.scope, b.scope)
    );
}

function normalizeRule(rule = {}, layer = 'unknown', index = 0) {
    return {
        id: String(rule.id || `${layer}-${index + 1}`),
        effect: String(rule.effect || 'allow').toLowerCase(),
        tool: normalizePattern(rule.tool),
        actor: normalizePattern(rule.actor),
        scope: normalizePattern(rule.scope),
        reason: rule.reason || '',
        layer,
        index,
        raw: rule
    };
}

function buildLayeredRules({ globalPolicies = [], projectPolicies = [], userPolicies = [] } = {}) {
    const layers = [
        { layer: 'global', rules: asArray(globalPolicies) },
        { layer: 'project', rules: asArray(projectPolicies) },
        { layer: 'user', rules: asArray(userPolicies) }
    ];

    const normalized = [];
    for (const bucket of layers) {
        bucket.rules.forEach((rule, index) => {
            normalized.push(normalizeRule(rule, bucket.layer, index));
        });
    }

    return normalized;
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

        matched.sort((a, b) => (EFFECT_PRIORITY[b.effect] || 0) - (EFFECT_PRIORITY[a.effect] || 0));

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

    static verifyPolicyPack(policyPack = {}, options = {}) {
        const criticalTools = asArray(options.criticalTools || DEFAULT_CRITICAL_TOOLS);
        const rules = buildLayeredRules(policyPack);
        const violations = [];
        const warnings = [];

        for (let i = 0; i < rules.length; i += 1) {
            const a = rules[i];
            if (!['allow', 'confirm', 'block'].includes(a.effect)) {
                violations.push({
                    code: 'invalid_effect',
                    ruleId: a.id,
                    layer: a.layer,
                    severity: 'critical',
                    message: `Rule ${a.id} uses unsupported effect '${a.effect}'.`
                });
            }

            if (a.effect === 'allow') {
                for (const criticalTool of criticalTools) {
                    if (wildcardMatch(criticalTool, a.tool)) {
                        violations.push({
                            code: 'critical_allow_override',
                            ruleId: a.id,
                            layer: a.layer,
                            severity: 'critical',
                            message: `Rule ${a.id} allows critical tool '${criticalTool}'.`
                        });
                    }
                }
            }

            for (let j = i + 1; j < rules.length; j += 1) {
                const b = rules[j];
                if (!rulesIntersect(a, b)) {
                    continue;
                }

                if (a.effect !== b.effect) {
                    violations.push({
                        code: 'overlapping_conflict',
                        ruleId: `${a.id},${b.id}`,
                        layer: `${a.layer},${b.layer}`,
                        severity: 'high',
                        message: `Rules ${a.id} (${a.effect}) and ${b.id} (${b.effect}) overlap with conflicting effects.`
                    });
                }

                const aPriority = EFFECT_PRIORITY[a.effect] || 0;
                const bPriority = EFFECT_PRIORITY[b.effect] || 0;

                if (aPriority >= bPriority && ruleContains(a, b) && a.effect !== b.effect) {
                    warnings.push({
                        code: 'shadowed_rule',
                        ruleId: b.id,
                        layer: b.layer,
                        severity: 'medium',
                        message: `Rule ${b.id} is shadowed by stricter rule ${a.id}.`
                    });
                } else if (bPriority >= aPriority && ruleContains(b, a) && a.effect !== b.effect) {
                    warnings.push({
                        code: 'shadowed_rule',
                        ruleId: a.id,
                        layer: a.layer,
                        severity: 'medium',
                        message: `Rule ${a.id} is shadowed by stricter rule ${b.id}.`
                    });
                }
            }
        }

        const dedupe = (items) => {
            const seen = new Set();
            return items.filter((item) => {
                const key = `${item.code}:${item.ruleId}:${item.message}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };

        const finalViolations = dedupe(violations);
        const finalWarnings = dedupe(warnings);
        const hasCritical = finalViolations.some((v) => v.severity === 'critical' || v.severity === 'high');

        return {
            valid: !hasCritical,
            summary: {
                totalRules: rules.length,
                violations: finalViolations.length,
                warnings: finalWarnings.length,
                criticalTools
            },
            violations: finalViolations,
            warnings: finalWarnings
        };
    }
}
