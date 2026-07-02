const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    // storedName is a UUID generated server-side - the original filename is
    // never stored in full (only the extension, for MIME hint) so a crafted
    // filename cannot be used to attack the download path.
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Server-controlled only. No route ever reads status from req.body.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, maxlength: 1000, default: '' },
    // Documents submitted by the applicant (ID, income proof). Stored by
    // UUID filename; downloaded only via the secure /documents/:id endpoint.
    documents: { type: [documentSchema], default: [] },
  },
  { timestamps: true }
);

applicationSchema.index({ propertyId: 1, status: 1 });
applicationSchema.index({ applicantId: 1 });

// Unique constraint: one application per applicant per property.
applicationSchema.index({ propertyId: 1, applicantId: 1 }, { unique: true });

const Application = mongoose.model('Application', applicationSchema);

module.exports = Application;
