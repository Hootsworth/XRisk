export function enforceAgentBoundary({ actorRole, action }) {
    const roleMatrix = {
        planner: ['read_file', 'fetch_web', 'analyze'],
        executor: ['run_shell', 'write_file', 'patch_file', 'deploy', 'github_push'],
        reviewer: ['read_file', 'analyze', 'approve']
    };

    const allowed = roleMatrix[actorRole] || [];
    const ok = allowed.includes(action.tool);

    return {
        decision: ok ? 'allow' : 'block',
        reason: ok ? 'Action allowed for role.' : `Role ${actorRole} cannot invoke ${action.tool}.`
    };
}
