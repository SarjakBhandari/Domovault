const AuditLog = require('../models/AuditLog');

// Write an audit log entry. Metadata must contain only non-sensitive summary
// fields (amounts, status values, resource IDs) - never passwords, tokens,
// full document contents, or PII.
async function writeAuditLog({ actorId = null, action, targetType, targetId = null, metadata = {} }) {
  try {
    await AuditLog.create({ actorId, action, targetType, targetId, metadata });
  } catch (err) {
    // Audit logging failures must not break the primary operation. Log to
    // stderr in non-production environments for visibility.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[audit] Failed to write audit log:', err.message);
    }
  }
}

// Predefined action constants so callers use a stable, filterable set of
// strings rather than free-form text that can drift.
const ACTIONS = {
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_PROOF_UPLOADED: 'PAYMENT_PROOF_UPLOADED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',
  LEASE_CREATED: 'LEASE_CREATED',
  LEASE_ENDED: 'LEASE_ENDED',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PROPERTY_CREATED: 'PROPERTY_CREATED',
  PROPERTY_UPDATED: 'PROPERTY_UPDATED',
  PROPERTY_DELETED: 'PROPERTY_DELETED',
  DOCUMENT_DOWNLOADED: 'DOCUMENT_DOWNLOADED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  PROPERTY_BULK_IMPORTED: 'PROPERTY_BULK_IMPORTED',
  BILL_REQUESTED: 'BILL_REQUESTED',
  BILL_REQUEST_SENT: 'BILL_REQUEST_SENT',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  TENANT_REMOVED: 'TENANT_REMOVED',
  USER_DELETED: 'USER_DELETED',
  OAUTH_LOGIN:  'OAUTH_LOGIN',
};

module.exports = { writeAuditLog, ACTIONS };
