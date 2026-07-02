const mongoose = require('mongoose');

const billingCycleSchema = new mongoose.Schema(
  {
    leaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, required: true },
    // Copied from the lease (which copied from the property) at creation time.
    // Never accepted from the client - prevents a tenant from paying a
    // self-specified amount.
    amount: { type: Number, required: true },
    // State machine transitions:
    //   pending_proof: waiting for tenant to upload payment proof
    //   proof_submitted: tenant uploaded proof; pending owner confirmation
    //   pending_confirmation: alias kept for explicit two-step confirmation
    //   confirmed: owner marked the payment as received
    //   rejected: owner rejected the proof (tenant must re-upload)
    status: {
      type: String,
      enum: ['pending_proof', 'proof_submitted', 'pending_confirmation', 'confirmed', 'rejected'],
      default: 'pending_proof',
    },
    paymentProof: {
      storedName: { type: String, default: null },
      mimeType: { type: String, default: null },
      sizeBytes: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },
    confirmedAt: { type: Date, default: null },
    // Who confirmed/rejected (the owning property's admin). Never client-settable.
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, maxlength: 500, default: null },
  },
  { timestamps: true }
);

billingCycleSchema.index({ tenantId: 1, status: 1 });
billingCycleSchema.index({ ownerId: 1, status: 1 });
// One billing cycle per lease per due date - prevents duplicate cycles for
// the same month.
billingCycleSchema.index({ leaseId: 1, dueDate: 1 }, { unique: true });

const BillingCycle = mongoose.model('BillingCycle', billingCycleSchema);

module.exports = BillingCycle;
