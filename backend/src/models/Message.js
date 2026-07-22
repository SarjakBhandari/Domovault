const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // conversationId is the canonical sorted pair "smallerId_largerId" so the
    // same two users always share the same conversation without a separate
    // Conversation document.
    conversationId: { type: String, required: true, index: true },
    senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body:           { type: String, required: true, trim: true, maxlength: 2000 },
    read:           { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ recipientId: 1, read: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
