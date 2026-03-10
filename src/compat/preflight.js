import os from 'os';

function classifyGoal(toolName) {
    const t = String(toolName || '').toLowerCase();
    if (['read_file', 'read_dir', 'fetch_web', 'browser_interact'].includes(t)) return 'inspect';
    if (['write_file', 'patch_file', 'scaffold', 'project_scaffold', 'fix'].includes(t)) return 'modify';
    if (['github_push', 'docker_push', 'deploy'].includes(t)) return 'release';
    if (['os_agent', 'mouse_click', 'type_text'].includes(t)) return 'os_automation';
    return 'general_assist';
}

function buildRiskFlags(toolName, toolArgs) {
    const t = String(toolName || '').toLowerCase();
    const argsText = JSON.stringify(toolArgs || {}).toLowerCase();
    const flags = [];

    if (['manage_power', 'deploy', 'github_push', 'docker_push', 'send_email'].includes(t)) {
        flags.push('external_side_effect');
    }

    if (['write_file', 'patch_file', 'run_shell', 'run_python', 'os_agent', 'mouse_click', 'type_text'].includes(t)) {
        flags.push('local_state_change');
    }

    if (t === 'run_shell' && /(shutdown|restart|format|rm\s+-rf|del\s+\/s|sc\s+stop)/i.test(argsText)) {
        flags.push('destructive_shell_pattern');
    }

    if (['os_agent', 'mouse_click', 'type_text'].includes(t)) {
        flags.push('os_control');
    }

    return flags;
}

function classifySituation(toolName, toolArgs, historyContext = []) {
    const t = String(toolName || '').toLowerCase();
    const argsText = JSON.stringify(toolArgs || {}).toLowerCase();
    const recent = Array.isArray(historyContext)
        ? historyContext.slice(-6).map((m) => String(m?.content || '').toLowerCase()).join('\n')
        : '';

    if (t === 'browser_interact' && /preflight_analyse|diagnose/.test(argsText)) {
        return 'browser_health_check';
    }
    if (t === 'browser_interact' && /wait_for_auth|auth_state/.test(argsText)) {
        return 'auth_resolution';
    }
    if (t === 'browser_interact' && /click|type|hover|evaluate/.test(argsText)) {
        return 'risky_browser_interaction';
    }
    if (/about:blank|blank page|recovery failed/.test(recent)) {
        return 'blank_page_recovery';
    }
    if (/blocked|captcha|access denied|forbidden/.test(recent)) {
        return 'automation_blocker';
    }
    if (/loop|stuck|same action 3 times/.test(recent)) {
        return 'loop_recovery';
    }
    return 'general';
}

function buildSubplanTemplate(situationType, toolName) {
    if (situationType === 'blank_page_recovery') {
        return [
            'Run preflight_analyse with autoHeal=true',
            'Attempt return to last healthy URL or search fallback',
            'Verify interactable snapshot before retrying risky action'
        ];
    }
    if (situationType === 'automation_blocker') {
        return [
            'Refresh context and switch search surface',
            'Avoid blocked host path and pivot to alternate source',
            'Resume parent task once reachable page is confirmed'
        ];
    }
    if (situationType === 'auth_resolution') {
        return [
            'Check auth_state and prompt user for manual login if required',
            'Wait for auth completion with timeout',
            'Resume parent task after auth wall is cleared'
        ];
    }
    if (situationType === 'loop_recovery') {
        return [
            'Stop repeating same action/selector',
            'Re-scan page and choose alternative element or route',
            'Execute alternate step and validate page-state change'
        ];
    }
    if (String(toolName || '').toLowerCase() === 'browser_interact') {
        return [
            'Validate target selector/action confidence',
            'Execute one browser interaction',
            'Verify mutation or URL/title change and continue'
        ];
    }
    return [
        `Validate action for tool ${toolName}`,
        `Execute tool ${toolName}`,
        'Capture output and record debrief'
    ];
}

function estimateConfidence(situationType, riskFlags = []) {
    let score = 0.8;
    if (situationType === 'blank_page_recovery' || situationType === 'automation_blocker') score -= 0.25;
    if (situationType === 'loop_recovery') score -= 0.2;
    if (riskFlags.includes('destructive_shell_pattern')) score -= 0.35;
    if (riskFlags.includes('os_control')) score -= 0.1;
    return Math.max(0.15, Math.min(0.98, score));
}

export function runPreflightAnalysis({ toolName, toolArgs, sessionMeta, historyContext }) {
    const userGoal = String(sessionMeta?.topLevelRequest || '').trim();
    const recentTurns = Array.isArray(historyContext) ? historyContext.slice(-4).map(m => m?.content || '').join('\n').slice(0, 1000) : '';

    const riskFlags = buildRiskFlags(toolName, toolArgs);
    const situationType = classifySituation(toolName, toolArgs, historyContext);

    const missionPacket = {
        goal: classifyGoal(toolName),
        situationType,
        confidence: estimateConfidence(situationType, riskFlags),
        userObjective: userGoal || 'unspecified',
        environment: {
            platform: process.platform,
            osRelease: os.release(),
            cwd: process.cwd(),
            timestamp: new Date().toISOString()
        },
        plan: buildSubplanTemplate(situationType, toolName),
        riskFlags,
        recommendedSubplanTemplate: buildSubplanTemplate(situationType, toolName),
        fallbackOrder: ['retry-once', 'alternate-approach', 'ask-user-review'],
        contextSnippet: recentTurns
    };

    return missionPacket;
}
