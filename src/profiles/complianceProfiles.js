export const COMPLIANCE_PROFILES = {
    developer: {
        telemetryEnabled: false,
        requireEvidence: false,
        requireSecondApprover: false,
        strictEgress: false
    },
    enterprise: {
        telemetryEnabled: true,
        requireEvidence: true,
        requireSecondApprover: true,
        strictEgress: true
    },
    high_security: {
        telemetryEnabled: false,
        requireEvidence: true,
        requireSecondApprover: true,
        strictEgress: true
    }
};

export function getComplianceProfile(name = 'developer') {
    return COMPLIANCE_PROFILES[name] || COMPLIANCE_PROFILES.developer;
}
