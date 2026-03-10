import assert from 'assert';
import { createNodeXRisk, getComplianceProfile } from '../src/index.js';

const profile = getComplianceProfile('enterprise');
const xrisk = createNodeXRisk({
    telemetry: { enabled: profile.telemetryEnabled, localOnly: true },
    approvals: { requireSecondApprover: profile.requireSecondApprover },
    egress: { allowedDomains: ['api.example.com'], deniedDomains: ['evil.example'] },
    policies: {
        globalPolicies: [
            { id: 'deny-deploy-in-readonly', tool: 'deploy', actor: '*', scope: '*', effect: 'confirm', reason: 'Deploy requires approval.' }
        ],
        projectPolicies: [
            { id: 'deny-direct-power', tool: 'manage_power', effect: 'block', reason: 'Power actions are blocked by default.' }
        ],
        userPolicies: []
    }
});

const blockResult = xrisk.assess({
    action: { tool: 'manage_power', actor: 'agent', actorRole: 'executor' },
    prompt: 'run now',
    payload: { note: 'safe payload' }
});

assert.equal(blockResult.decision, 'block');

const confirmResult = xrisk.assess({
    action: { tool: 'deploy', actor: 'agent', actorRole: 'executor' },
    prompt: 'deploy this',
    approvalContext: { reason: 'Release requested by user' },
    payload: { email: 'test@example.com' },
    egressUrl: 'https://unknown-host.invalid/path'
});

assert.equal(confirmResult.decision, 'confirm');
assert.ok(confirmResult.approvalRequest?.id);

const modelCheck = xrisk.verifyModelResponse({
    primary: { answer: '42', evidence: ['doc-1'] },
    secondary: [{ answer: '42', evidence: ['doc-1'] }],
    requireEvidence: true
});

assert.equal(modelCheck.decision, 'allow');

const audit = xrisk.getAuditStatus();
assert.equal(audit.valid, true);

console.log('XRisk engine tests passed.');
