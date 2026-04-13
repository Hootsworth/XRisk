#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { createNodeXRisk, getComplianceProfile } from '../src/index.js';

function printUsage() {
    console.log(`XRisk CLI

Usage:
  xrisk assess [--action-file <path>] [--payload-file <path>] [--prompt <text>] [--egress-url <url>] [--profile <name>] [--policies-file <path>] [--compact]
  xrisk verify-model --input-file <path> [--profile <name>] [--policies-file <path>] [--compact]
    xrisk validate-policies --policies-file <path> [--critical-tools <csv>] [--compact]

Notes:
  - If --action-file is omitted for 'assess', JSON is read from stdin.
  - profiles: developer | enterprise | high_security
`);
}

function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith('--')) {
                out[key] = true;
            } else {
                out[key] = next;
                i += 1;
            }
        } else {
            out._.push(token);
        }
    }
    return out;
}

function readJsonFile(filePath) {
    const fullPath = path.resolve(process.cwd(), filePath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function readStdinJson() {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw.trim()) {
        throw new Error('Expected JSON input on stdin.');
    }
    return JSON.parse(raw);
}

function buildEngineConfig(args) {
    const profile = getComplianceProfile(String(args.profile || 'developer'));
    const policyPack = args['policies-file'] ? readJsonFile(args['policies-file']) : {};

    return {
        telemetry: { enabled: profile.telemetryEnabled, localOnly: true },
        approvals: { requireSecondApprover: profile.requireSecondApprover },
        egress: profile.strictEgress
            ? { allowedDomains: [], deniedDomains: [] }
            : { allowedDomains: [], deniedDomains: [] },
        policies: {
            globalPolicies: policyPack.globalPolicies || [],
            projectPolicies: policyPack.projectPolicies || [],
            userPolicies: policyPack.userPolicies || []
        }
    };
}

function printJson(data, compact) {
    process.stdout.write(`${JSON.stringify(data, null, compact ? 0 : 2)}\n`);
}

function run() {
    const args = parseArgs(process.argv.slice(2));
    const command = args._[0];

    if (!command || args.help || args.h) {
        printUsage();
        process.exit(0);
    }

    const xrisk = createNodeXRisk(buildEngineConfig(args));
    const compact = Boolean(args.compact);

    if (command === 'assess') {
        const action = args['action-file'] ? readJsonFile(args['action-file']) : readStdinJson();
        const payload = args['payload-file'] ? readJsonFile(args['payload-file']) : {};

        const result = xrisk.assess({
            action,
            payload,
            prompt: args.prompt || '',
            egressUrl: args['egress-url'] || undefined,
            approvalContext: { reason: 'CLI approval request' }
        });

        printJson(result, compact);
        process.exit(result.decision === 'block' ? 2 : 0);
    }

    if (command === 'verify-model') {
        if (!args['input-file']) {
            throw new Error('verify-model requires --input-file <path>.');
        }
        const input = readJsonFile(args['input-file']);
        const result = xrisk.verifyModelResponse(input);
        printJson(result, compact);
        process.exit(result.decision === 'allow' ? 0 : 2);
    }

    if (command === 'validate-policies') {
        if (!args['policies-file']) {
            throw new Error('validate-policies requires --policies-file <path>.');
        }

        const policyPack = readJsonFile(args['policies-file']);
        const criticalTools = args['critical-tools']
            ? String(args['critical-tools']).split(',').map((v) => v.trim()).filter(Boolean)
            : undefined;
        const result = xrisk.validatePolicies(policyPack, { criticalTools });
        printJson(result, compact);
        process.exit(result.valid ? 0 : 2);
    }

    throw new Error(`Unknown command: ${command}`);
}

try {
    run();
} catch (error) {
    process.stderr.write(`XRisk CLI error: ${error.message}\n`);
    process.exit(1);
}
