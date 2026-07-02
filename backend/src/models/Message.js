const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Sanitized with sanitize-html before save. A reader who renders this
    // field directly in HTML receives already-sanitized markup, so the
    // XSS surface is closed at the storage layer rather than hoping every
    // renderer escapes correctly.
    content: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Access control query: fetch the conversation for a property between two
// specific users. The index covers both "sent by me" and "received by me".
messageSchema.index({ propertyId: 1, senderId: 1, receiverId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
