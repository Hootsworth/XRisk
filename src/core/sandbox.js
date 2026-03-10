export function issueCapabilityToken({ tool, actor = 'default', scope = {}, ttlMs = 60000, singleUse = true }) {
    const now = Date.now();
    return {
        tool,
        actor,
        scope,
        singleUse,
        issuedAt: now,
        expiresAt: now + Math.max(1, ttlMs),
        consumed: false
    };
}

export function validateCapabilityToken(token, action = {}) {
    if (!token) return { valid: false, reason: 'missing_token' };
    if (token.consumed && token.singleUse) return { valid: false, reason: 'token_consumed' };
    if (Date.now() > token.expiresAt) return { valid: false, reason: 'token_expired' };
    if (token.tool !== action.tool) return { valid: false, reason: 'tool_scope_mismatch' };

    if (Array.isArray(token.scope.allowedPaths) && token.scope.allowedPaths.length) {
        const target = String(action.targetPath || '');
        const within = token.scope.allowedPaths.some((prefix) => target.startsWith(prefix));
        if (!within) return { valid: false, reason: 'filesystem_scope_violation' };
    }

    return { valid: true };
}

export function consumeCapabilityToken(token) {
    if (token && token.singleUse) token.consumed = true;
    return token;
}
