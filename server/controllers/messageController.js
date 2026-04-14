
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import ogs from 'open-graph-scraper';

export const allMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    const messages = await Message.find({ 
      conversation: chatId,
      clearedBy: { $ne: req.user._id }
    }).
    populate('sender', 'name profilePic email').
    populate('reactions.user', 'name profilePic email').
    populate('replyTo', 'text sender fileUrl').
    populate('conversation');

    // Filter out expired burn messages
    const now = Date.now();
    const activeMessages = messages.filter(m => !m.isBurn || !m.expiresAt || new Date(m.expiresAt).getTime() > now);

    res.json(activeMessages);
  } catch (error) {
    console.error('Error in allMessages:', error);
    res.status(400).json({ message: error.message });
  }
};

export const clearMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    // Push req.user._id into clearedBy array for ALL current messages in this conversation
    await Message.updateMany(
      { conversation: chatId },
      { $addToSet: { clearedBy: req.user._id } }
    );

    res.json({ message: 'Chat history cleared for you' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  const { content, chatId, fileUrl, fileType, replyTo, isBurn } = req.body;

  if (!content && !fileUrl || !chatId) {
    console.log('Invalid data passed into request');
    return res.status(400).json({ message: 'Invalid data passed into request' });
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: 'Invalid Chat ID' });
  }

  let metadata = null;
  if (content) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    if (urls && urls.length > 0) {
      try {
        const { result } = await ogs({ url: urls[0] });
        if (result.success) {
          metadata = {
            title: result.ogTitle,
            description: result.ogDescription,
            image: result.ogImage?.[0]?.url,
            url: result.ogUrl || urls[0]
          };
        }
      } catch (e) {
        console.log('OGS scraping failed:', e.message);
      }
    }
  }

  const newMessage = {
    sender: req.user._id,
    text: content,
    conversation: chatId,
    fileUrl,
    fileType,
    replyTo: replyTo || undefined,
    isBurn: isBurn || false,
    metadata
  };

  try {
    let message = await Message.create(newMessage);

    message = await message.populate('sender', 'name profilePic');
    message = await message.populate('conversation');
    message = await message.populate('replyTo', 'text sender fileUrl');
    message = await User.populate(message, {
      path: 'conversation.participants',
      select: 'name profilePic email'
    });

    await Conversation.findByIdAndUpdate(req.body.chatId, { lastMessage: message });

    // Check if any other participant is online to mark as delivered
    const chat = await Conversation.findById(chatId).populate('participants');
    const otherParticipants = chat?.participants.filter((p) => p._id.toString() !== req.user._id.toString());

    // This is a bit complex to do here without socket access, 
    // so we'll let the socket logic handle 'delivered' state.

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    const messagesToUpdate = await Message.find({
      conversation: chatId, sender: { $ne: req.user._id }, status: { $ne: 'read' }
    });

    const ids = messagesToUpdate.map(m => m._id);

    await Message.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { status: 'read' }, 
        $addToSet: { readBy: req.user._id } 
      }
    );

    // Apply expiration to burn messages when read
    await Message.updateMany(
      { _id: { $in: ids }, isBurn: true, expiresAt: { $exists: false } },
      { $set: { expiresAt: new Date(Date.now() + 60000) } }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const markAsDelivered = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    await Message.updateMany(
      { conversation: chatId, sender: { $ne: req.user._id }, status: 'sent' },
      { $set: { status: 'delivered' } }
    );

    res.json({ message: 'Messages marked as delivered' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleReaction = async (req, res) => {
  const { messageId, emoji } = req.body;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Invalid Message ID' });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Check if user already reacted with this emoji
    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReactionIndex !== -1) {
      // Remove reaction
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction
      message.reactions.push({ emoji, user: userId });
    }

    await message.save();
    const updatedMessage = await Message.findById(messageId).
    populate('sender', 'name profilePic email').
    populate('reactions.user', 'name profilePic email').
    populate('conversation');

    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ message: 'Invalid Message ID' });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Only allow the sender to delete their own message
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    message.isDeleted = true;
    // Clear content for privacy but keep for auditing in DB (though we mark as deleted)
    // Actually, the user requested "mark as deleted (without actually removing them from history for auditing purposes)"
    // So we just set isDeleted = true.

    await message.save();

    const updatedMessage = await Message.findById(messageId).
    populate('sender', 'name profilePic email').
    populate('reactions.user', 'name profilePic email').
    populate('conversation');

    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};