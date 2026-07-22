const mongoose = require('mongoose');

const billRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    // ownerId is set server-side from the lease  -  never from request input.
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['pending', 'sent'], default: 'pending' },
  },
  { timestamps: true }
);

billRequestSchema.index({ tenantId: 1, status: 1 });
billRequestSchema.index({ ownerId: 1, status: 1 });

const BillRequest = mongoose.model('BillRequest', billRequestSchema);

module.exports = BillRequest;
