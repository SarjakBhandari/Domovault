const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // Stored pre-sanitized (sanitize-html runs before save in the controller).
    // The sanitized form is what clients receive, so a stored XSS payload would
    // need to survive sanitize-html's allow-list - it cannot.
    description: { type: String, required: true, maxlength: 5000 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    bedrooms: { type: Number, required: true, min: 0, max: 20 },
    bathrooms: { type: Number, required: true, min: 0, max: 20 },
    sizeSqft: { type: Number, required: true, min: 0 },
    amenities: { type: [String], default: [] },
    // Server-authoritative - never accepted from the client on updates.
    rentPerMonth: { type: Number, required: true, min: 0 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Server-controlled state machine: available -> pending -> leased.
    // Applicants can never set this directly.
    status: {
      type: String,
      enum: ['available', 'pending', 'leased'],
      default: 'available',
    },
    // Externally-fetched image URL (SSRF-checked before storage). Only the URL
    // is stored, not the image file, so this can be null.
    imageUrl: { type: String, default: null },
    // QR code stored by randomly-generated filename, never the original name.
    // Never returned in public responses - only accessible via the secure
    // /api/billing/:id/qr-code endpoint which checks tenant ownership.
    qrCodeStoredName: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

// Index for common search patterns (city + status + rent).
propertySchema.index({ city: 1, status: 1, rentPerMonth: 1 });
propertySchema.index({ ownerId: 1 });

const Property = mongoose.model('Property', propertySchema);

module.exports = Property;
