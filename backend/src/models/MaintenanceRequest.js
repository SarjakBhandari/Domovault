const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const maintenanceRequestSchema = new mongoose.Schema(
  {
    leaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Sanitized with sanitize-html before save (XSS prevention on save).
    description: { type: String, required: true, maxlength: 2000 },
    // Server-controlled state machine. Tenants cannot set this directly.
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    photos: { type: [photoSchema], default: [] },
    // Owner's response notes, also sanitized on save.
    ownerNotes: { type: String, maxlength: 1000, default: null },
  },
  { timestamps: true }
);

maintenanceRequestSchema.index({ tenantId: 1 });
maintenanceRequestSchema.index({ ownerId: 1, status: 1 });
maintenanceRequestSchema.index({ propertyId: 1 });

const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);

module.exports = MaintenanceRequest;
