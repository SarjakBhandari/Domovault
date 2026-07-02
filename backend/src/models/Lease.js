const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Rent amount is copied from the property at the moment the lease is
    // created and is never client-editable after that point. Owners cannot
    // retroactively change the rent a tenant is being billed.
    rentAmount: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
  },
  { timestamps: true }
);

leaseSchema.index({ tenantId: 1, status: 1 });
leaseSchema.index({ ownerId: 1 });
leaseSchema.index({ propertyId: 1 });

const Lease = mongoose.model('Lease', leaseSchema);

module.exports = Lease;
