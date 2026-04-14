import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { connectDB } from './config/db.js';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import multer from 'multer';
import webpush from 'web-push';
import PushSubscription from './models/PushSubscription.js';
import { protect } from './middleware/auth.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('socketio', io);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.post('/api/v1/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  res.json({ url: `/uploads/${req.file.filename}` });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/ai', aiRoutes);

// Push Notification Subscription
app.post('/api/v1/notifications/subscribe', protect, async (req, res) => {
  const subscription = req.body;
  try {
    await PushSubscription.findOneAndUpdate(
      { user: req.user._id },
      { user: req.user._id, subscription },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Failed to subscribe' });
  }
});

app.get('/api/v1/notifications/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI;

// Socket.IO Logic
const onlineUsers = new Map(); // userId -> set of socketIds

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('setup', (userId) => {
    if (!userId) return;
    const normalizedUserId = String(userId);
    socket.join(normalizedUserId);
    const existingSockets = onlineUsers.get(normalizedUserId) || new Set();
    existingSockets.add(socket.id);
    onlineUsers.set(normalizedUserId, existingSockets);

    socket.emit('online_users', Array.from(onlineUsers.keys()).filter((id) => id !== normalizedUserId));
    io.emit('user_online', normalizedUserId);
    console.log('User setup:', normalizedUserId);
  });

  socket.on('request_online_users', () => {
    let userId = null;
    for (const [id, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        userId = id;
        break;
      }
    }
    if (userId) {
      socket.emit('online_users', Array.from(onlineUsers.keys()).filter((id) => id !== userId));
    }
  });

  socket.on('join_chat', (room) => {
    socket.join(room);
    console.log('User joined room:', room);
  });

  socket.on('typing', (data) => {
    if (typeof data === 'string') {
      socket.in(data).emit('typing', data);
    } else {
      socket.in(data.room).emit('typing', data);
    }
  });

  socket.on('stop_typing', (data) => {
    if (typeof data === 'string') {
      socket.in(data).emit('stop_typing', data);
    } else {
      socket.in(data.room).emit('stop_typing', data);
    }
  });

  socket.on('new_message', async (newMessageReceived) => {
    const chat = newMessageReceived.conversation;
    if (!chat || !chat.participants) return console.log('Chat or participants not defined');

    chat.participants.forEach(async (participant) => {
      const participantId = participant._id.toString();
      if (participantId === newMessageReceived.sender._id.toString()) return;

      // Emit socket event to the participant's user room
      io.to(participantId).emit('message_received', newMessageReceived);

      // Check if user has muted the conversation
      const isMuted = chat.mutedBy && chat.mutedBy.some(id => id.toString() === participantId);

      // Check if user is offline to send push notification
      if (!onlineUsers.has(participantId) && !isMuted) {
        try {
          const pushSubs = await PushSubscription.find({ user: participantId });
          const payload = JSON.stringify({
            title: chat.isGroup ? chat.groupName : newMessageReceived.sender.name,
            body: newMessageReceived.isSystem ? newMessageReceived.text : `${newMessageReceived.sender.name}: ${newMessageReceived.text || 'Sent a file'}`,
            icon: newMessageReceived.sender.profilePic || '/logo.png',
            url: '/',
            chatId: chat._id
          });

          pushSubs.forEach((sub) => {
            webpush.sendNotification(sub.subscription, payload).catch((err) => {
              console.error('Error sending push notification:', err);
              if (err.statusCode === 410 || err.statusCode === 404) {
                PushSubscription.findByIdAndDelete(sub._id).catch(() => {});
              }
            });
          });
        } catch (error) {
          console.error('Push notification error:', error);
        }
      }
    });
  });

  socket.on('message_read', (data) => {
    const { chatId, userId } = data;
    io.to(chatId).emit('message_status_updated', { chatId, userId, status: 'read' });
  });

  socket.on('message_delivered', (data) => {
    const { chatId, userId } = data;
    io.to(chatId).emit('message_status_updated', { chatId, userId, status: 'delivered' });
  });

  socket.on('chat_updated', (updatedChat) => {
    updatedChat.participants.forEach((user) => {
      socket.in(user._id).emit('chat_metadata_updated', updatedChat);
    });
  });

  socket.on('message_reaction', (data) => {
    const { chatId, messageId, reactions } = data;
    socket.in(chatId).emit('message_reaction_updated', { messageId, reactions });
  });

  socket.on('message_deleted', (data) => {
    const { chatId, messageId } = data;
    socket.in(chatId).emit('message_deleted_updated', { messageId });
  });

  // --- WebRTC Video Call Signaling ---
  socket.on('call_user', (data) => {
    const { userToCall, signalData, from, callerName, chatRoom } = data;
    io.to(userToCall).emit('incoming_call', { signal: signalData, from, callerName, chatRoom });
  });

  socket.on('answer_call', (data) => {
    io.to(data.to).emit('call_accepted', data.signal);
  });

  socket.on('ice_candidate', (data) => {
    io.to(data.to).emit('ice_candidate', data.candidate);
  });

  socket.on('end_call', (data) => {
    io.to(data.to).emit('call_ended');
  });

  socket.on('disconnect', () => {
    let disconnectedUserId = '';
    for (const [userId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        disconnectedUserId = userId;

        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_offline', userId);
        } else {
          onlineUsers.set(userId, sockets);
        }
        break;
      }
    }
    console.log('User disconnected', disconnectedUserId || socket.id);
  });
});

// Vite Integration
async function startServer() {
  // VAPID Setup
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:snehalkolhe2628@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('VAPID details set');
  } else {
    console.warn('VAPID keys not found. Push notifications will not work.');
    const keys = webpush.generateVAPIDKeys();
    console.log('Generated new VAPID keys (add these to your .env):');
    console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
    // Use them for this session
    webpush.setVapidDetails(
      'mailto:snehalkolhe2628@gmail.com',
      keys.publicKey,
      keys.privateKey
    );
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  }

  await connectDB();

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), '../client/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();