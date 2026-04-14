
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

export const accessChat = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'UserId not sent' });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid User ID' });
  }

  try {
    // Fetch the target user details first for displayName
    const targetUser = await User.findById(userId).select('_id name profilePic email');
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    let isChat = await Conversation.find({
      isGroup: false,
      $and: [
      { participants: { $elemMatch: { $eq: req.user._id } } },
      { participants: { $elemMatch: { $eq: userId } } }]

    }).
    populate('participants', '-password').
    populate('lastMessage');

    isChat = await User.populate(isChat, {
      path: 'lastMessage.sender',
      select: 'name profilePic email'
    });

    if (isChat.length > 0) {
      const existingChat = isChat[0].toObject ? isChat[0].toObject() : isChat[0];
      existingChat.otherUser = targetUser;
      existingChat.displayName = existingChat.isGroup ? existingChat.groupName : targetUser.name;
      existingChat.displayPic = existingChat.isGroup ? existingChat.groupPic : targetUser.profilePic;
      res.send(existingChat);
    } else {
      const chatData = {
        groupName: 'sender',
        isGroup: false,
        participants: [req.user._id, userId]
      };

      const createdChat = await Conversation.create(chatData);
      const fullChat = await Conversation.findOne({ _id: createdChat._id }).populate(
        'participants',
        '-password'
      );
      const chatResponse = fullChat?.toObject ? fullChat.toObject() : fullChat;

      // Always use the target user we fetched explicitly
      chatResponse.otherUser = targetUser;
      chatResponse.displayName = chatResponse.isGroup ? chatResponse.groupName : targetUser.name;
      chatResponse.displayPic = chatResponse.isGroup ? chatResponse.groupPic : targetUser.profilePic;
      res.status(200).json(chatResponse);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const fetchChats = async (req, res) => {
  try {
    let results = await Conversation.find({ participants: { $elemMatch: { $eq: req.user._id } } }).
    populate('participants', 'name profilePic email').
    populate('groupAdmin', 'name profilePic email').
    populate('lastMessage').
    sort({ updatedAt: -1 });

    results = await User.populate(results, {
      path: 'lastMessage.sender',
      select: 'name profilePic email'
    });

    const formattedResults = results.map((chat) => {
      const chatObject = chat.toObject ? chat.toObject() : chat;
      if (!chatObject.isGroup && Array.isArray(chatObject.participants)) {
        const otherUser = chatObject.participants.find((participant) => String(participant._id) !== String(req.user._id));
        chatObject.otherUser = otherUser;
        chatObject.displayName = otherUser?.name || 'Chat';
        chatObject.displayPic = otherUser?.profilePic || '';
      } else if (chatObject.isGroup) {
        chatObject.displayName = chatObject.groupName;
        chatObject.displayPic = chatObject.groupPic || '';
      }
      return chatObject;
    });

    res.status(200).send(formattedResults);
  } catch (error) {
    console.error('Error in fetchChats:', error);
    res.status(400).json({ message: error.message });
  }
};

export const createGroupChat = async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: 'Please Fill all the fields' });
  }

  const users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return res.status(400).send('More than 2 users are required to form a group chat');
  }

  users.push(req.user._id);

  try {
    const groupChat = await Conversation.create({
      groupName: req.body.name,
      participants: users,
      isGroup: true,
      groupAdmin: req.user._id,
      groupPic: req.body.groupPic || ''
    });

    // Create system message
    const systemMessage = await Message.create({
      sender: req.user._id,
      conversation: groupChat._id,
      text: `${req.user.name} created the group "${req.body.name}"`,
      isSystem: true
    });

    const populatedSystemMessage = await Message.findById(systemMessage._id).
    populate('sender', 'name profilePic email').
    populate('conversation');

    const fullGroupChat = await Conversation.findOne({ _id: groupChat._id }).
    populate('participants', '-password').
    populate('groupAdmin', '-password');

    const io = req.app.get('socketio');
    if (io) {
      users.forEach((u) => {
        const userId = u._id ? u._id.toString() : u.toString();
        if (userId === req.user._id.toString()) return;
        io.to(userId).emit('message_received', populatedSystemMessage);
        io.to(userId).emit('chat_metadata_updated', fullGroupChat);
      });
    }

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const renameGroup = async (req, res) => {
  const { chatId, chatName } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: 'Invalid Chat ID' });
  }

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      { groupName: chatName },
      { new: true }
    ).
    populate('participants', '-password').
    populate('groupAdmin', '-password');

    if (!updatedChat) {
      res.status(404).json({ message: 'Chat Not Found' });
    } else {
      // Create system message
      const systemMessage = await Message.create({
        sender: req.user._id,
        conversation: chatId,
        text: `${req.user.name} renamed the group to "${chatName}"`,
        isSystem: true
      });

      const populatedSystemMessage = await Message.findById(systemMessage._id).
      populate('sender', 'name profilePic email').
      populate('conversation');

      const io = req.app.get('socketio');
      if (io) {
        updatedChat.participants.forEach((u) => {
          if (u._id.toString() === req.user._id.toString()) return;
          io.to(u._id.toString()).emit('message_received', populatedSystemMessage);
          io.to(u._id.toString()).emit('chat_metadata_updated', updatedChat);
        });
      }

      res.json(updatedChat);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateGroupDetails = async (req, res) => {
  const { chatId, chatName, groupPic } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return res.status(400).json({ message: 'Invalid Chat ID' });
  }

  const updateFields = {};
  if (chatName) updateFields.groupName = chatName;
  if (groupPic !== undefined) updateFields.groupPic = groupPic;

  try {
    const updatedChat = await Conversation.findByIdAndUpdate(
      chatId,
      updateFields,
      { new: true }
    )
      .populate('participants', '-password')
      .populate('groupAdmin', '-password');

    if (!updatedChat) {
      return res.status(404).json({ message: 'Chat Not Found' });
    }

    // Create system message
    let text = `${req.user.name} updated the group settings`;
    if (chatName && groupPic) text = `${req.user.name} renamed the group to "${chatName}" and changed the icon`;
    else if (chatName) text = `${req.user.name} renamed the group to "${chatName}"`;
    else if (groupPic) text = `${req.user.name} changed the group icon`;

    const systemMessage = await Message.create({
      sender: req.user._id,
      conversation: chatId,
      text,
      isSystem: true
    });

    const populatedSystemMessage = await Message.findById(systemMessage._id)
      .populate('sender', 'name profilePic email')
      .populate('conversation');

    const io = req.app.get('socketio');
    if (io) {
      updatedChat.participants.forEach((u) => {
        if (u._id.toString() === req.user._id.toString()) return;
        io.to(u._id.toString()).emit('message_received', populatedSystemMessage);
        io.to(u._id.toString()).emit('chat_metadata_updated', updatedChat);
      });
    }

    res.json(updatedChat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const removeFromGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid Chat or User ID' });
  }

  try {
    const removed = await Conversation.findByIdAndUpdate(
      chatId,
      { $pull: { participants: userId } },
      { new: true }
    ).
    populate('participants', '-password').
    populate('groupAdmin', '-password');

    if (!removed) {
      res.status(404).json({ message: 'Chat Not Found' });
    } else {
      // Create system message
      const targetUser = await User.findById(userId);
      const systemMessage = await Message.create({
        sender: req.user._id,
        conversation: chatId,
        text: userId === req.user._id.toString() ?
        `${req.user.name} left the group` :
        `${req.user.name} removed ${targetUser?.name || 'a user'}`,
        isSystem: true
      });

      const populatedSystemMessage = await Message.findById(systemMessage._id).
      populate('sender', 'name profilePic email').
      populate('conversation');

      const io = req.app.get('socketio');
      if (io) {
        removed.participants.forEach((u) => {
          if (u._id.toString() === req.user._id.toString()) return;
          io.to(u._id.toString()).emit('message_received', populatedSystemMessage);
          io.to(u._id.toString()).emit('chat_metadata_updated', removed);
        });
        // Also notify the removed user if they didn't leave voluntarily
        if (userId !== req.user._id.toString()) {
          io.to(userId).emit('message_received', populatedSystemMessage);
          io.to(userId).emit('chat_metadata_updated', { ...removed, isRemoved: true });
        }
      }

      res.json(removed);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const addToGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: 'Invalid Chat or User ID' });
  }

  try {
    const added = await Conversation.findByIdAndUpdate(
      chatId,
      { $push: { participants: userId } },
      { new: true }
    ).
    populate('participants', '-password').
    populate('groupAdmin', '-password');

    if (!added) {
      res.status(404).json({ message: 'Chat Not Found' });
    } else {
      // Create system message
      const targetUser = await User.findById(userId);
      const systemMessage = await Message.create({
        sender: req.user._id,
        conversation: chatId,
        text: `${req.user.name} added ${targetUser?.name || 'a user'}`,
        isSystem: true
      });

      const populatedSystemMessage = await Message.findById(systemMessage._id).
      populate('sender', 'name profilePic email').
      populate('conversation');

      const io = req.app.get('socketio');
      if (io) {
        added.participants.forEach((u) => {
          if (u._id.toString() === req.user._id.toString()) return;
          io.to(u._id.toString()).emit('message_received', populatedSystemMessage);
          io.to(u._id.toString()).emit('chat_metadata_updated', added);
        });
      }

      res.json(added);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const exportChatHistory = async (req, res) => {
  try {
    const chats = await Conversation.find({ participants: { $elemMatch: { $eq: req.user._id } } }).
    populate('participants', 'name email profilePic').
    populate('groupAdmin', 'name email');

    const chatData = [];
    for (const chat of chats) {
      const messages = await Message.find({ conversation: chat._id }).
      populate('sender', 'name email profilePic').
      sort({ createdAt: 1 });

      chatData.push({
        chat,
        messages
      });
    }

    res.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        name: req.user.name,
        email: req.user.email
      },
      data: chatData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const importChatHistory = async (req, res) => {
  const { data } = req.body;
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ message: 'Invalid backup data' });
  }

  try {
    for (const item of data) {
      const { chat, messages } = item;

      const participantEmails = chat.participants.map((p) => p.email);
      const participantUsers = await User.find({ email: { $in: participantEmails } });
      const participantIds = participantUsers.map((u) => u._id);

      if (participantIds.length < 2) continue;

      let existingChat = await Conversation.findOne({
        isGroup: chat.isGroup,
        participants: { $all: participantIds, $size: participantIds.length }
      });

      if (!existingChat) {
        existingChat = await Conversation.create({
          groupName: chat.groupName,
          isGroup: chat.isGroup,
          participants: participantIds,
          groupAdmin: participantIds[0]
        });
      }

      for (const msg of messages) {
        const sender = await User.findOne({ email: msg.sender.email });
        if (!sender) continue;

        const existingMsg = await Message.findOne({
          conversation: existingChat._id,
          sender: sender._id,
          text: msg.text,
          createdAt: msg.createdAt
        });

        if (!existingMsg) {
          await Message.create({
            sender: sender._id,
            conversation: existingChat._id,
            text: msg.text,
            fileUrl: msg.fileUrl,
            fileType: msg.fileType,
            status: msg.status,
            isSystem: msg.isSystem,
            createdAt: msg.createdAt,
            updatedAt: msg.updatedAt,
            reactions: msg.reactions
          });
        }
      }
    }
    res.json({ message: 'Backup restored successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleMute = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    const chat = await Conversation.findById(id);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const isMuted = chat.mutedBy.includes(req.user._id);
    
    if (isMuted) {
      chat.mutedBy.pull(req.user._id);
    } else {
      chat.mutedBy.push(req.user._id);
    }

    await chat.save();
    
    // Return updated mutedBy array so frontend can sync
    res.json({ mutedBy: chat.mutedBy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Chat ID' });
    }

    const chat = await Conversation.findById(id);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Verify user is part of the chat
    if (!chat.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this chat' });
    }

    // Delete chat completely
    await Conversation.findByIdAndDelete(id);
    // Delete all messages in this chat
    await Message.deleteMany({ conversation: id });

    res.json({ message: 'Chat permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};