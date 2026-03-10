export function simulateAction(action = {}) {
    const effects = [];

    if (action.tool === 'write_file' || action.tool === 'patch_file') {
        effects.push('filesystem_change');
    }
    if (action.tool === 'run_shell') {
        effects.push('process_spawn');
    }
    if (action.tool === 'github_push' || action.tool === 'deploy') {
        effects.push('external_side_effect');
    }

    return {
        dryRun: true,
        action,
        predictedEffects: effects,
        riskHint: effects.includes('external_side_effect') ? 'high' : effects.length ? 'medium' : 'low'
    };
}
