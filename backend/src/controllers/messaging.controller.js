const mongoose = require('mongoose');
const Message = require('../models/Message');
const Property = require('../models/Property');
const { sanitizePlainText } = require('../utils/sanitize');

// Returns all conversations (unique property+partner pairs) for the caller.
async function listConversations(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.sub);

    // Aggregate to get the latest message per (propertyId, partner) pair.
    const conversations = await Message.aggregate([
      {
        $match: { $or: [{ senderId: userId }, { receiverId: userId }] },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            propertyId: '$propertyId',
            partner: {
              $cond: {
                if: { $eq: ['$senderId', userId] },
                then: '$receiverId',
                else: '$senderId',
              },
            },
          },
          latestMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', userId] },
                    { $eq: ['$readAt', null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'latestMessage.createdAt': -1 } },
    ]);

    return res.json(conversations);
  } catch (err) {
    next(err);
  }
}

// Returns all messages in a conversation about a specific property between
// the caller and one other participant. Access control: only the two
// participants can see the thread.
async function getConversation(req, res, next) {
  try {
    const { propertyId, partnerId } = req.params;
    const userId = req.user.sub;

    const messages = await Message.find({
      propertyId,
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    // Mark unread messages as read.
    await Message.updateMany(
      { propertyId, receiverId: userId, senderId: partnerId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return res.json(messages);
  } catch (err) {
    next(err);
  }
}

// Send a message. The receiver must be either the property owner (for
// applicants/tenants) or a known applicant/tenant (for admins). This prevents
// arbitrary messaging between unrelated users.
async function sendMessage(req, res, next) {
  try {
    const { propertyId } = req.params;
    const { receiverId, content } = req.body;
    const senderId = req.user.sub;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // An applicant or tenant can only message the property owner.
    // An admin can only message users on their own properties.
    const isAdmin = req.user.role === 'admin';
    if (isAdmin) {
      if (property.ownerId.toString() !== senderId) {
        return res.status(403).json({ error: 'You do not own this property' });
      }
    } else {
      if (receiverId !== property.ownerId.toString()) {
        return res.status(403).json({ error: 'You can only message the property owner' });
      }
    }

    // Sanitize on save: strip all HTML tags from message content (messages are
    // plain text, not rich text, so all markup is unwanted).
    const message = await Message.create({
      propertyId,
      senderId,
      receiverId,
      content: sanitizePlainText(content),
    });

    return res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

module.exports = { listConversations, getConversation, sendMessage };
