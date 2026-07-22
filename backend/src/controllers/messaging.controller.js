const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');

// Build the canonical conversation ID from two user IDs. The smaller
// string-comparison ID is always first so both parties reference the same key.
function conversationId(a, b) {
  return a.toString() < b.toString()
    ? `${a}_${b}`
    : `${b}_${a}`;
}

// Send a message. Only admin-tenant pairs are allowed: a tenant can only
// message an admin and vice versa. IDOR check: the recipient must exist and
// have the expected role.
async function sendMessage(req, res, next) {
  try {
    const { recipientId, body } = req.body;
    const senderId = req.user.sub;

    if (recipientId === senderId) {
      return res.status(400).json({ error: 'Cannot send a message to yourself' });
    }

    const recipient = await User.findById(recipientId).select('role');
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Enforce admin-tenant-only communication.
    const senderRole = req.user.role;
    const recipientRole = recipient.role;
    const allowed =
      (senderRole === 'tenant' && recipientRole === 'admin') ||
      (senderRole === 'admin' && recipientRole === 'tenant');
    if (!allowed) {
      return res.status(403).json({ error: 'Messaging is only available between admin and tenant' });
    }

    const cid = conversationId(senderId, recipientId);
    const message = await Message.create({
      conversationId: cid,
      senderId,
      recipientId,
      body,
    });

    return res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// Get all messages in a conversation between the current user and another user.
// Only returns messages where one of the parties is the current user (IDOR
// prevention  -  the conversationId is derived server-side from the two user IDs,
// never accepted from the client).
async function getConversation(req, res, next) {
  try {
    const myId = req.user.sub;
    const otherId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const other = await User.findById(otherId).select('fullName role avatarStoredName');
    if (!other) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cid = conversationId(myId, otherId);
    const messages = await Message.find({ conversationId: cid })
      .sort({ createdAt: 1 })
      .lean();

    // Mark all unread messages addressed to the current user as read.
    await Message.updateMany(
      { conversationId: cid, recipientId: myId, read: false },
      { read: true }
    );

    return res.json({ messages, other: other.toJSON() });
  } catch (err) {
    next(err);
  }
}

// List all conversations the current user participates in, with the latest
// message and unread count. The query uses the conversationId index.
async function listConversations(req, res, next) {
  try {
    const myId = req.user.sub;

    // Find the latest message in every conversation this user is part of.
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(myId) },
            { recipientId: new mongoose.Types.ObjectId(myId) },
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$conversationId',
          latestMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$recipientId', new mongoose.Types.ObjectId(myId)] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'latestMessage.createdAt': -1 } },
    ]);

    // Populate the other participant's name for each conversation.
    const populated = await Promise.all(
      conversations.map(async (conv) => {
        const msg = conv.latestMessage;
        const otherId = msg.senderId.toString() === myId ? msg.recipientId : msg.senderId;
        const other = await User.findById(otherId).select('fullName role avatarStoredName').lean();
        return {
          conversationId: conv._id,
          other,
          latestMessage: { body: msg.body, createdAt: msg.createdAt, senderId: msg.senderId },
          unreadCount: conv.unreadCount,
        };
      })
    );

    return res.json(populated);
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, getConversation, listConversations };
