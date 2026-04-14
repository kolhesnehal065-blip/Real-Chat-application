import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import api from '../../services/api.js';
import { MoreVertical, Send, Paperclip, Smile, Loader2, Check, CheckCheck, FileText, Download, X, Mic, Square, Trash2, Search, ChevronUp, ChevronDown, Forward, ArrowLeft, Flame, Sparkles, XCircle, Reply, Info, Phone, Video, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import GroupInfo from './GroupInfo.jsx';
import ContactInfoModal from './ContactInfoModal.jsx';
import VideoCallInterface from '../Video/VideoCallInterface.jsx';
import VoiceMessagePlayer from './VoiceMessagePlayer.jsx';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useTheme } from '../../context/ThemeContext.jsx';

const BurnTimer = ({ expiresAt, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onExpire) onExpire();
      return;
    }
    const timer = setInterval(() => {
      const remaining = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, timeLeft, onExpire]);

  return (
    <span className="text-[10px] text-red-500 font-bold ml-1 animate-pulse flex items-center gap-0.5">
      <Flame className="w-3 h-3" /> {timeLeft}s
    </span>
  );
};

const ChatWindow = ({ fetchAgain, setFetchAgain, socket, toggleSidebar }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const longPressTimerRef = useRef(null);
  const isTouchRef = useRef(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMessageId) {
        setActiveMessageId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeMessageId]);

  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [chats, setChats] = useState([]);
  const [forwarding, setForwarding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const { user } = useAuth();
  const { theme } = useTheme();
  const [chatWallpaper, setChatWallpaper] = useState(localStorage.getItem('chatWallpaper') || '');

  // New AI & Threading Modals State
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [callDetails, setCallDetails] = useState(null);

  const [smartReplies, setSmartReplies] = useState([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [chatSummary, setChatSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isBurnMode, setIsBurnMode] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    const handleIncomingCall = ({ signal, from, callerName, chatRoom }) => {
      setReceivingCall(true);
      setIncomingSignal(signal);
      setCallDetails({ from, callerName, chatRoom });
      setShowVideoCall(true);
    };

    socket.on('incoming_call', handleIncomingCall);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
    };
  }, [socket]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioChunksRef.current.length > 0) {
          await sendVoiceMessage(audioBlob);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice_message.webm');
      const { data: uploadData } = await api.post('/upload', formData);

      const { data } = await api.post('/messages', {
        fileUrl: uploadData.url,
        fileType: 'audio',
        chatId: selectedChat._id
      });

      socket.emit('new_message', data);
      setMessages([...messages, data]);
      setContextChats((prev) => {
        const updatedChats = [...prev];
        const chatIndex = updatedChats.findIndex((c) => String(c._id) === String(selectedChat._id));
        if (chatIndex !== -1) {
          updatedChats[chatIndex] = { ...updatedChats[chatIndex], lastMessage: data, updatedAt: new Date().toISOString() };
          return updatedChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  const startVoiceToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setNewMessage((prev) => prev + finalTranscript);
      } else if (interimTranscript) {
        // Show interim results as the user is speaking
        setNewMessage((prev) => {
          if (prev.includes('[listening]')) {
            return prev.split('[listening]')[0].trim() + ' ' + interimTranscript;
          }
          return prev + (prev ? ' ' : '') + interimTranscript;
        });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      alert('Error: ' + event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopVoiceToText = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const { selectedChat, setSelectedChat, notification, setNotification, clearNotifications, chats: contextChats, setChats: setContextChats } = useChat();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isDocumentActive = () =>
  typeof document !== 'undefined' &&
  document.visibilityState === 'visible';

  const fetchMessages = async () => {
    if (!selectedChat || !selectedChat._id) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/messages/${selectedChat._id}`);
      if (Array.isArray(data)) {
        setMessages(data);
        if (isDocumentActive()) {
          markAsRead();
        }
        // Mark as delivered whenever chat is opened, because chat was loaded by the recipient
        markAsDelivered();
        // Clear notifications for this chat
        clearNotifications(selectedChat._id);
      } else {
        console.error('Expected array for messages, got:', data);
        setMessages([]);
      }
      socket?.emit('join_chat', selectedChat._id);
    } catch (error) {
      console.error('Failed to fetch messages:', error.response?.data?.message || error.message);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMute = async () => {
    try {
      const { data } = await api.put(`/chats/${selectedChat._id}/mute`);
      setSelectedChat(prev => ({ ...prev, mutedBy: data.mutedBy }));
      
      setContextChats(prevChats => 
        prevChats.map(c => 
          String(c._id) === String(selectedChat._id) ? { ...c, mutedBy: data.mutedBy } : c
        )
      );
    } catch (error) {
      console.error('Failed to toggle mute');
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("Are you sure you want to clear these messages for yourself?")) return;
    try {
      await api.put(`/messages/clear/${selectedChat._id}`);
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear chat');
    }
  };

  const handleDeleteChat = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this chat? This cannot be undone.")) return;
    try {
      await api.delete(`/chats/${selectedChat._id}`);
      setSelectedChat(null);
      setContextChats(prevChats => prevChats.filter(c => String(c._id) !== String(selectedChat._id)));
    } catch (error) {
      console.error('Failed to delete chat');
    }
  };

  const fetchSmartReplies = async (text) => {
    if (!text) return;
    try {
      setIsLoadingReplies(true);
      const { data } = await api.post('/ai/replies', { messageText: text });
      if (data && data.replies) setSmartReplies(data.replies);
    } catch (e) {
      console.error('Failed to fetch smart replies', e);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const fetchChatSummary = async () => {
    if (!messages || messages.length === 0) return;
    try {
      setIsLoadingSummary(true);
      const { data } = await api.post('/ai/summary', { 
        messages: messages.slice(-30).map(m => ({ 
          senderName: m.sender?.name, 
          text: m.text 
        }))
      });
      if (data && data.summary) setChatSummary(data.summary);
    } catch (e) {
      console.error('Failed to fetch chat summary', e);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const markAsRead = async () => {
    if (!selectedChat?._id || !user?._id) return;
    try {
      await api.put(`/messages/${selectedChat._id}/read`);
      socket?.emit('message_read', { chatId: selectedChat._id, userId: user._id });
    } catch (error) {

      // Silently fail as it might be redundant
    }};

  const markAsDelivered = async () => {
    if (!selectedChat?._id || !user?._id) return;
    try {
      await api.put(`/messages/${selectedChat._id}/delivered`);
      socket?.emit('message_delivered', { chatId: selectedChat._id, userId: user._id });
    } catch (error) {

      // Silently fail
    }};

  useEffect(() => {
    setTypingUsers([]);
    fetchMessages();
    const handleTyping = (data) => {
      if (typeof data === 'object' && data.user && data.room === selectedChat?._id) {
        setTypingUsers((prev) => {
          if (prev.find((u) => u._id === data.user._id)) return prev;
          return [...prev, data.user];
        });
      }
    };

    const handleStopTyping = (data) => {
      if (typeof data === 'object' && data.user && data.room === selectedChat?._id) {
        setTypingUsers((prev) => prev.filter((u) => u._id !== data.user._id));
      }
    };

    const statusPriority = { sent: 1, delivered: 2, read: 3 };

    const handleMessageStatusUpdated = (data) => {
      // Only update status if it was triggered by someone else
      if (String(data.chatId) === String(selectedChat?._id) && String(data.userId) !== String(user?._id)) {
        setMessages((prev) =>
        prev.map((m) => {
          // If I am the sender, update status based on recipient's action
          if (String(m.sender?._id) === String(user?._id)) {
            const currentPriority = statusPriority[m.status] || 0;
            const newPriority = statusPriority[data.status] || 0;
            if (newPriority > currentPriority) {
              return { ...m, status: data.status };
            }
          }
          return m;
        })
        );
      }
    };

    socket?.on('typing', handleTyping);
    socket?.on('stop_typing', handleStopTyping);
    socket?.on('message_status_updated', handleMessageStatusUpdated);

    const handleMessageReactionUpdated = (data) => {
      setMessages((prev) =>
      prev.map((m) => {
        if (m._id === data.messageId) {
          return { ...m, reactions: data.reactions };
        }
        return m;
      })
      );
    };

    const handleMessageDeletedUpdated = (data) => {
      setMessages((prev) =>
      prev.map((m) => {
        if (m._id === data.messageId) {
          return { ...m, isDeleted: true };
        }
        return m;
      })
      );
    };

    const handleOnlineUsers = (onlineIds) => {
      const normalizedOnlineIds = onlineIds.map(String);
      setChats((prevChats) =>
      prevChats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((p) => {
          const isOnline = normalizedOnlineIds.includes(String(p._id));
          return { ...p, isOnline };
        })
      }))
      );
      setSelectedChat((prevChat) => {
        if (!prevChat) return prevChat;
        return {
          ...prevChat,
          participants: prevChat.participants.map((p) => {
            const isOnline = normalizedOnlineIds.includes(String(p._id));
            return { ...p, isOnline };
          })
        };
      });
    };

    const handleUserOnline = (userId) => {
      setChats((prevChats) =>
      prevChats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((p) =>
        String(p._id) === String(userId) ? { ...p, isOnline: true } : p
        )
      }))
      );
      setSelectedChat((prevChat) => {
        if (!prevChat) return prevChat;
        return {
          ...prevChat,
          participants: prevChat.participants.map((p) =>
          String(p._id) === String(userId) ? { ...p, isOnline: true } : p
          )
        };
      });
    };

    const handleUserOffline = (userId) => {
      setChats((prevChats) =>
      prevChats.map((chat) => ({
        ...chat,
        participants: chat.participants.map((p) =>
        String(p._id) === String(userId) ? { ...p, isOnline: false, lastSeen: new Date().toISOString() } : p
        )
      }))
      );
      setSelectedChat((prevChat) => {
        if (!prevChat) return prevChat;
        return {
          ...prevChat,
          participants: prevChat.participants.map((p) =>
          String(p._id) === String(userId) ? { ...p, isOnline: false, lastSeen: new Date().toISOString() } : p
          )
        };
      });
    };

    socket?.on('message_reaction_updated', handleMessageReactionUpdated);
    socket?.on('message_deleted_updated', handleMessageDeletedUpdated);
    socket?.on('online_users', handleOnlineUsers);
    socket?.on('user_online', handleUserOnline);
    socket?.on('user_offline', handleUserOffline);

    // Auto-read when user focuses/returns to window
    const onWindowFocus = () => {
      if (isDocumentActive()) {
        markAsRead();
      }
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      socket?.off('typing', handleTyping);
      socket?.off('stop_typing', handleStopTyping);
      socket?.off('message_status_updated', handleMessageStatusUpdated);
      socket?.off('message_reaction_updated', handleMessageReactionUpdated);
      socket?.off('message_deleted_updated', handleMessageDeletedUpdated);
      socket?.off('online_users', handleOnlineUsers);
      socket?.off('user_online', handleUserOnline);
      socket?.off('user_offline', handleUserOffline);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [selectedChat?._id, socket, user?._id, fetchAgain]);

  useEffect(() => {
    const handleMessageReceived = (newMessageReceived) => {
      if (selectedChat && selectedChat._id === newMessageReceived.conversation._id) {
        setMessages((prev) => prev.some((m) => m._id === newMessageReceived._id) ? prev : [...prev, newMessageReceived]);
        if (isDocumentActive()) {
          markAsRead();
        }
        
        // Always attempt smart replies if it's from the other person
        if (String(newMessageReceived.sender?._id || newMessageReceived.sender) !== String(user?._id)) {
          fetchSmartReplies(newMessageReceived.text);
        }

        clearNotifications(selectedChat._id);
      }
      // Emit delivered for any message received while online
      socket?.emit('message_delivered', { chatId: newMessageReceived.conversation._id, userId: user?._id });
    };

    socket?.on('message_received', handleMessageReceived);

    return () => {
      socket?.off('message_received', handleMessageReceived);
    };
  }, [selectedChat, socket, user?._id]);

  useEffect(() => {
    const handleActivityChange = () => {
      if (isDocumentActive() && selectedChat?._id) {
        markAsRead();
      }
    };

    document.addEventListener('visibilitychange', handleActivityChange);
    window.addEventListener('focus', handleActivityChange);
    window.addEventListener('blur', handleActivityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleActivityChange);
      window.removeEventListener('focus', handleActivityChange);
      window.removeEventListener('blur', handleActivityChange);
    };
  }, [selectedChat?._id, socket, user?._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e, textOverride = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const txt = textOverride || newMessage;
    if (!txt.trim()) return;

    socket.emit('stop_typing', selectedChat._id);
    try {
      const { data } = await api.post('/messages', {
        content: txt,
        chatId: selectedChat._id,
        replyTo: replyingTo?._id,
        isBurn: isBurnMode
      });
      if (!textOverride) setNewMessage('');
      setReplyingTo(null);
      setSmartReplies([]);
      socket.emit('new_message', data);
      setMessages((prev) => [...prev, data]);
      setContextChats((prevChats) => {
        const updatedChats = [...prevChats];
        const chatIndex = updatedChats.findIndex((c) => String(c._id) === String(selectedChat._id));
        if (chatIndex !== -1) {
          updatedChats[chatIndex] = { ...updatedChats[chatIndex], lastMessage: data, updatedAt: new Date().toISOString() };
          return updatedChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        return prevChats;
      });
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data: uploadData } = await api.post('/upload', formData);

      const { data } = await api.post('/messages', {
        fileUrl: uploadData.url,
        fileType: file.type.startsWith('image/') ? 'image' : 'document',
        chatId: selectedChat._id
      });

      socket.emit('new_message', data);
      setMessages((prev) => [...prev, data]);
      setContextChats((prevChats) => {
        const updatedChats = [...prevChats];
        const chatIndex = updatedChats.findIndex((c) => String(c._id) === String(selectedChat._id));
        if (chatIndex !== -1) {
          updatedChats[chatIndex] = { ...updatedChats[chatIndex], lastMessage: data, updatedAt: new Date().toISOString() };
          return updatedChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        return prevChats;
      });
    } catch (error) {
      console.error('File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const lastTypingTimeRef = useRef(0);

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !selectedChat?._id) return;

    if (!typing) {
      setTyping(true);
      socket.emit('typing', { room: selectedChat._id, user: { _id: user?._id, name: user?.name } });
    }

    lastTypingTimeRef.current = new Date().getTime();
    const timerLength = 3000;

    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTimeRef.current;
      if (timeDiff >= timerLength && typing) {
        socket.emit('stop_typing', { room: selectedChat._id, user: { _id: user?._id, name: user?.name } });
        setTyping(false);
      }
    }, timerLength);
  };

  const getSender = (loggedUser, participants) => {
    if (!participants || participants.length < 2) return null;
    const loggedUserId = String(loggedUser?._id);
    const firstId = String(participants[0]._id);
    return firstId === loggedUserId ? participants[1] : participants[0];
  };

  const formatSafeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return format(date, 'HH:mm');
  };

  const getDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const { data } = await api.post('/messages/reaction', { messageId, emoji });
      // CRITICAL FIX: Only update the reactions field to avoid losing metadata/replyTo state
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions: data.reactions } : m));
      socket?.emit('message_reaction', {
        chatId: selectedChat._id,
        messageId,
        reactions: data.reactions
      });
    } catch (error) {
      console.error('Failed to toggle reaction', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      setMessages((prev) =>
      prev.map((m) => {
        if (m._id === messageId) {
          return { ...m, isDeleted: true };
        }
        return m;
      })
      );
      socket?.emit('message_deleted', {
        chatId: selectedChat._id,
        messageId
      });
    } catch (error) {
      console.error('Failed to delete message');
    }
  };

  const openForwardModal = (message) => {
    setForwardingMessage(message);
    setShowForwardModal(true);
    fetchChats();
  };

  const fetchChats = async () => {
    try {
      const { data } = await api.get('/chats');
      setChats(data);
    } catch (error) {
      console.error('Failed to fetch chats');
    }
  };

  const handleForward = async (targetChatId) => {
    if (!forwardingMessage) return;
    setForwarding(true);
    try {
      const { data } = await api.post('/messages', {
        content: forwardingMessage.text ? `[Forwarded]: ${forwardingMessage.text}` : '',
        chatId: targetChatId,
        fileUrl: forwardingMessage.fileUrl,
        fileType: forwardingMessage.fileType
      });

      socket?.emit('new_message', data);
      setShowForwardModal(false);
      setForwardingMessage(null);
      alert('Message forwarded successfully!');
    } catch (error) {
      console.error('Failed to forward message');
      alert('Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  const onEmojiClick = (emojiData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(-1);
      return;
    }

    const results = [];
    messages.forEach((m, index) => {
      if (m.text && m.text.toLowerCase().includes(query.toLowerCase())) {
        results.push(index);
      }
    });
    setSearchResults(results);
    setCurrentResultIndex(results.length > 0 ? results.length - 1 : -1);

    if (results.length > 0) {
      scrollToMessage(results[results.length - 1]);
    }
  };

  const scrollToMessage = (index) => {
    const messageElement = document.getElementById(`message-${messages[index]._id}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const navigateSearch = (direction) => {
    if (searchResults.length === 0) return;
    let newIndex = currentResultIndex;
    if (direction === 'up') {
      newIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    } else {
      newIndex = (currentResultIndex + 1) % searchResults.length;
    }
    setCurrentResultIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  const sender = selectedChat && !selectedChat.isGroup && selectedChat.participants ? getSender(user, selectedChat.participants) : null;
  const otherUser = selectedChat && !selectedChat.isGroup ? selectedChat.otherUser || selectedChat.participants?.find((p) => String(p._id) !== String(user?._id)) : null;

  const getGroupStatusLabel = () => {
    if (!selectedChat || !selectedChat.isGroup || !selectedChat.participants) return '';

    const otherMembers = selectedChat.participants.filter((participant) => String(participant._id) !== String(user?._id));
    const memberNames = otherMembers.map((participant) => participant.name || 'Unknown');

    if (memberNames.length === 0) {
      return `${selectedChat.participants.length} members`;
    }

    const visibleNames = memberNames.slice(0, 3).join(', ');
    const extraCount = memberNames.length - 3;

    return `Members: ${visibleNames}${extraCount > 0 ? ` +${extraCount}` : ''}`;
  };

  const getChatTitle = () => {
    if (!selectedChat) return 'Chat';
    if (selectedChat.isGroup) return selectedChat.groupName || selectedChat.displayName || 'Group Chat';
    return selectedChat.displayName || 'Chat';
  };

  const getChatAvatar = () => {
    if (!selectedChat) return `https://ui-avatars.com/api/?name=Chat`;
    if (selectedChat.isGroup) return selectedChat.groupPic || selectedChat.displayPic || `https://ui-avatars.com/api/?name=${selectedChat.groupName || 'Group'}`;
    return selectedChat.displayPic || selectedChat.otherUser?.profilePic || sender?.profilePic || `https://ui-avatars.com/api/?name=${getChatTitle()}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#020617] relative transition-colors duration-300">
      {/* Header */}
      <div className="relative z-[1000] p-4 flex items-center justify-between border-b border-transparent transition-colors duration-300">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            className="md:hidden p-1.5 hover:bg-gray-200 dark:hover:bg-[#475569] rounded-full transition-colors text-gray-500 dark:text-gray-400 mr-1"
            onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </button>
          <img
            src={getChatAvatar()}
            className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
            alt="Avatar"
            referrerPolicy="no-referrer" />
          
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-50 leading-tight text-lg">
              {getChatTitle()}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {typingUsers.length > 0 ? 'typing...' : selectedChat.isGroup ? getGroupStatusLabel() : sender?.isOnline ? 'Online' : `Last seen ${formatSafeTime(sender?.lastSeen)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 relative">
          <button
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#475569] transition-colors"
            title="Audio Call">
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setReceivingCall(false);
              setShowVideoCall(true);
            }}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-[#475569] transition-colors"
            title="Video Call">
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowHeaderMenu(!showHeaderMenu)}
            className={`p-2 rounded-full transition-colors ${showHeaderMenu ? 'bg-gray-200 dark:bg-[#475569]' : 'hover:bg-gray-200 dark:hover:bg-[#475569]'}`}
            title="Menu">
            
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {showHeaderMenu &&
              <>
                {/* Full-screen Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[900] bg-black/5 dark:bg-black/40 backdrop-blur-[1px]"
                  onClick={() => setShowHeaderMenu(false)}
                />
                
                {/* Dropdown Menu */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] py-2 z-[1000] border border-gray-200/50 dark:border-gray-700/50 origin-top-right">
                
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors"
                  onClick={() => {
                    if (selectedChat.isGroup) setShowUpdateModal(true);else
                    setShowContactInfo(true);
                    setShowHeaderMenu(false);
                  }}>
                  
                    {selectedChat.isGroup ? 'Group info' : 'Contact info'}
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors"
                  onClick={() => {
                    setShowSearch(true);
                    setShowHeaderMenu(false);
                  }}>
                    Search
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-[#38bdf8] font-medium text-[15px] transition-colors flex items-center gap-2"
                  onClick={() => {
                    fetchChatSummary();
                    setShowHeaderMenu(false);
                  }}>
                    {isLoadingSummary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Summarize
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors"
                  onClick={() => {
                    setReceivingCall(false);
                    setShowVideoCall(true);
                    setShowHeaderMenu(false);
                  }}>
                  
                    Video call
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors flex justify-between items-center"
                  onClick={() => {
                    handleToggleMute();
                    setShowHeaderMenu(false);
                  }}>
                  
                    <span>{selectedChat.mutedBy?.includes(user?._id) ? 'Unmute' : 'Mute notifications'}</span>
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors"
                  onClick={() => {
                    handleClearChat();
                    setShowHeaderMenu(false);
                  }}>
                  
                    Clear chat
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-800 dark:text-gray-200 text-[15px] transition-colors"
                  onClick={() => {
                    const url = window.prompt("Enter an image URL for the chat wallpaper (or leave blank to remove):");
                    if (url !== null) {
                      setChatWallpaper(url);
                      if (url) localStorage.setItem('chatWallpaper', url);
                      else localStorage.removeItem('chatWallpaper');
                    }
                    setShowHeaderMenu(false);
                  }}>
                    Change Wallpaper
                  </button>
                  <button
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#1e293b] text-red-500 text-[15px] transition-colors font-semibold"
                  onClick={() => {
                    handleDeleteChat();
                    setShowHeaderMenu(false);
                  }}>
                  
                    Delete Conversation
                  </button>
                </motion.div>
              </>
            }
          </AnimatePresence>
        </div>
      </div>

      {/* LLM Chat Summary Banner */}
      <AnimatePresence>
        {chatSummary && !showSearch &&
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/10 border-b border-[#38bdf8]/20 p-4 relative flex gap-3 text-sm z-30">
            <Sparkles className="w-5 h-5 text-[#38bdf8] mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-gray-700 dark:text-gray-300">
              <h4 className="font-bold text-[#38bdf8] mb-1">AI Context Summary</h4>
              <ul className="list-disc pl-4 space-y-1">
                {chatSummary.split('\n').filter(s => s.trim().length > 0).map((line, i) => (
                   <li key={i}>{line.replace(/^[-\*]\s*/, '')}</li>
                ))}
              </ul>
            </div>
            <button onClick={() => setChatSummary('')} className="p-1 self-start text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        }
      </AnimatePresence>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-white dark:bg-[#1e293b] border-b border-gray-200 dark:border-gray-800 p-2 flex items-center gap-2 z-10 overflow-hidden transition-colors duration-300">
          
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-1.5 bg-gray-100 dark:bg-[#334155] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0ea5e9] dark:text-gray-100 dark:placeholder-gray-500 transition-colors duration-300"
              autoFocus />
            
            </div>
            {searchResults.length > 0 &&
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{currentResultIndex + 1} of {searchResults.length}</span>
                <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <button onClick={() => navigateSearch('up')} className="p-1 hover:bg-gray-100 dark:hover:bg-[#475569] border-r border-gray-200 dark:border-gray-700">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => navigateSearch('down')} className="p-1 hover:bg-gray-100 dark:hover:bg-[#475569]">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
          }
            <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
              setCurrentResultIndex(-1);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#475569] rounded-full text-gray-400">
            
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        }
      </AnimatePresence>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 md:px-8 bg-transparent relative transition-colors duration-300 custom-scrollbar flex flex-col items-center"
        style={{ backgroundImage: chatWallpaper ? `url(${chatWallpaper})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {chatWallpaper && <div className="absolute inset-0 bg-white/40 dark:bg-black/60 pointer-events-none mix-blend-overlay z-0"></div>}
        
        <div className="relative z-10 w-full max-w-3xl space-y-0.5">
          {loading ?
          <div className="flex items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-[#0ea5e9]" />
            </div> :

          <AnimatePresence initial={false}>
              {Array.isArray(messages) && messages.map((m, i) => {
              const isOwn = m.sender?._id === user?._id;
              const showDateSeparator = i === 0 ||
              m.createdAt && messages[i - 1].createdAt &&
              format(new Date(messages[i - 1].createdAt), 'yyyy-MM-dd') !== format(new Date(m.createdAt), 'yyyy-MM-dd');

              const isFirstInGroup = i === 0 ||
              messages[i - 1].sender?._id !== m.sender?._id ||
              showDateSeparator;

              if (m.isSystem) {
                return (
                  <motion.div
                    key={m._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center my-4">
                    
                      <span className="px-3 py-1.5 bg-[#e1f3fb] dark:bg-[#1e293b] text-[11px] text-gray-600 dark:text-gray-400 rounded-lg shadow-sm border border-blue-100 dark:border-blue-900/30 font-medium">
                        {m.text}
                      </span>
                    </motion.div>);

              }

              return (
                <React.Fragment key={m._id}>
                    {showDateSeparator && m.createdAt &&
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center my-6">
                    
                        <span className="px-4 py-1 bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-md text-[11px] font-bold text-gray-500 dark:text-gray-400 rounded-full shadow-sm border border-gray-200/50 dark:border-gray-700/50 uppercase tracking-wider">
                          {getDateLabel(m.createdAt)}
                        </span>
                      </motion.div>
                  }
                    <motion.div
                    initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} ${isFirstInGroup ? 'mt-4' : 'mt-0.5'}`}>
                    
                      <div
                      id={`message-${m._id}`}
                      onPointerDown={(e) => {
                        if (e.pointerType === 'touch') {
                          isTouchRef.current = true;
                          longPressTimerRef.current = setTimeout(() => {
                            setActiveMessageId(m._id);
                          }, 400);
                        } else {
                          isTouchRef.current = false;
                        }
                      }}
                      onPointerUp={(e) => {
                        if (e.pointerType === 'touch' && longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                        }
                      }}
                      onPointerMove={(e) => {
                        if (e.pointerType === 'touch' && longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                        }
                      }}
                      onPointerCancel={(e) => {
                        if (e.pointerType === 'touch' && longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isTouchRef.current) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isTouchRef.current) {
                          setActiveMessageId(prev => prev === m._id ? null : m._id);
                        }
                      }}
                      className={`w-fit max-w-[80%] sm:max-w-[75%] md:max-w-[65%] px-4 py-3 pb-6 md:px-5 md:py-4 md:pb-7 ${isOwn ? 'rounded-3xl rounded-br-md' : 'rounded-3xl rounded-bl-md'} border relative transition-all duration-300 hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-xl ${
                      m.isBurn ? (isOwn ? 'border-red-300/50 bg-red-500 text-white' : 'border-red-500/50 border-dashed dark:bg-[#2c131a] bg-red-50 text-gray-800 dark:text-gray-100 shadow-sm') : (isOwn ? `bg-gradient-to-br from-[#1C3A2F] to-[#122A22] text-[#E0EBE6] border-transparent shadow-[0_8px_20px_-6px_rgba(18,42,34,0.4)]` : `bg-white/90 dark:bg-[#232931]/90 backdrop-blur-xl text-gray-800 dark:text-gray-200 border border-black/5 dark:border-white/5 shadow-[0_4px_12px_rgba(0,0,0,0.05)]`)} ${
                      searchResults[currentResultIndex] === i ? 'ring-2 ring-[#0ea5e9] ring-offset-2' : ''} ${m.isDeleted ? 'opacity-60 italic' : ''}`}>

                        {/* Reaction Picker & Actions (Horizontal Pill) */}
                        <AnimatePresence>
                        {activeMessageId === m._id && !m.isSystem && !m.isDeleted &&
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 25 }}
                            className={`absolute top-full mt-2 ${isOwn ? 'right-0 origin-top-right' : 'left-0 origin-top-left'} flex flex-row items-center gap-1 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-xl shadow-xl rounded-full p-1.5 z-[9999] border border-gray-200/50 dark:border-gray-700/50`}
                            onClick={(e) => e.stopPropagation()}>
                            
                            <div className="flex flex-row items-center gap-1 px-1">
                              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) =>
                                <button
                                  key={emoji}
                                  onClick={(e) => { e.stopPropagation(); handleReaction(m._id, emoji); setActiveMessageId(null); }}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full hover:scale-125 hover:-translate-y-1 transition-all text-lg active:scale-95">
                                  {emoji}
                                </button>
                              )}
                            </div>
                            
                            <div className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
                            
                            <div className="flex flex-row items-center gap-1 px-1">
                              {isOwn &&
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(m._id); setActiveMessageId(null); }}
                                  className="w-8 h-8 flex justify-center items-center hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-full transition-colors"
                                  title="Delete Message">
                                  <Trash2 className="w-[15px] h-[15px]" />
                                </button>
                              }
                              <button
                                onClick={(e) => { e.stopPropagation(); setReplyingTo(m); setActiveMessageId(null); }}
                                className="w-8 h-8 flex justify-center items-center hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
                                title="Reply">
                                <Reply className="w-[15px] h-[15px]" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); openForwardModal(m); setActiveMessageId(null); }}
                                className="w-8 h-8 flex justify-center items-center hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
                                title="Forward Message">
                                <Forward className="w-[15px] h-[15px]" />
                              </button>
                            </div>
                          </motion.div>
                        }
                        </AnimatePresence>

                        {!isOwn && selectedChat.isGroup && m.sender &&
                      <p className="text-[11px] font-bold text-[#0ea5e9] mb-1 px-1">{m.sender.name}</p>
                      }
                        
                        <div className="px-1">
                          {m.isDeleted ?
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 py-1">
                              <Trash2 className="w-3.5 h-3.5" /> This message was deleted
                            </p> :

                        <>
                              {m.replyTo &&
                                <div
                                  className={`mb-2 p-2 rounded-xl text-xs border-l-4 ${isOwn ? 'bg-black/10 border-emerald-200 text-emerald-50' : 'bg-black/5 dark:bg-black/20 border-[#0ea5e9] text-gray-600 dark:text-gray-300'}`}>
                                  <span className={`font-bold block mb-0.5 ${isOwn ? 'text-emerald-200' : 'text-[#0ea5e9]'}`}>{m.replyTo.sender?.name || 'Someone'}</span>
                                  <span className="line-clamp-2 truncate">{m.replyTo.text || (m.replyTo.fileUrl ? 'File attachment' : 'Message')}</span>
                                </div>
                              }

                              {m.fileUrl &&
                          <div className="mb-1.5 overflow-hidden rounded-lg">
                                  {m.fileType === 'image' ?
                            <div className="relative group/img">
                                      <img src={m.fileUrl} alt="Sent file" className="max-w-full rounded-lg cursor-pointer hover:brightness-95 transition-all" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors pointer-events-none"></div>
                                    </div> :
                            m.fileType === 'audio' ?
                            <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
                              <div className="inline-flex w-fit max-w-[240px] bg-[#0ea5e9]/20 border border-[#0ea5e9]/40 backdrop-blur-md rounded-[16px] shadow-sm overflow-hidden relative scale-90 origin-left">
                                  <VoiceMessagePlayer src={m.fileUrl} />
                              </div>
                            </div> :

                            <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-black/20 rounded-lg border border-black/5 dark:border-white/5 group/file">
                                      <div className="p-2 bg-white dark:bg-[#334155] rounded-lg shadow-sm">
                                        <FileText className="w-6 h-6 text-[#0ea5e9]" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">Document</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-tighter">PDF • 2.4 MB</p>
                                      </div>
                                      <a href={m.fileUrl} download className="p-2 hover:bg-white dark:hover:bg-[#475569] rounded-full transition-all shadow-sm">
                                        <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                      </a>
                                    </div>
                            }
                                </div>
                          }

                              {m.text &&
                          <div className="relative">
                                  {m.text.startsWith('[Forwarded]:') &&
                            <div className={`flex items-center gap-1 text-[10px] italic mb-1 border-l-2 pl-2 ${isOwn ? 'text-emerald-100 border-emerald-200' : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'}`}>
                                      <Forward className="w-3 h-3" /> Forwarded
                                    </div>
                            }
                                  <p className={`text-[14.5px] leading-relaxed break-words pr-14 py-0.5 ${isOwn ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                                    {searchQuery && m.text.toLowerCase().includes(searchQuery.toLowerCase()) ?
                              m.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                              part.toLowerCase() === searchQuery.toLowerCase() ?
                              <mark key={i} className="bg-[#0ea5e9]/30 dark:bg-[#0ea5e9]/50 text-gray-900 dark:text-gray-100 rounded-sm px-0.5 font-medium">{part}</mark> :
                              part
                              ) :
                              m.text.startsWith('[Forwarded]:') ? m.text.replace('[Forwarded]:', '').trim() : m.text}
                                  </p>

                                  {m.metadata && m.metadata.title && (
                                    <a href={m.metadata.url} target="_blank" rel="noopener noreferrer" className={`block mt-2 rounded-xl overflow-hidden shadow-sm border ${isOwn ? 'border-emerald-400/50 bg-black/10 hover:bg-black/20' : 'border-gray-200/50 dark:border-gray-700/50 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'} transition-colors no-underline`}>
                                      {m.metadata.image && (
                                        <img src={m.metadata.image} alt={m.metadata.title} className="w-full h-32 object-cover" />
                                      )}
                                      <div className="p-3">
                                        <h4 className={`text-sm font-semibold truncate ${isOwn ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>{m.metadata.title}</h4>
                                        <p className={`text-xs mt-0.5 line-clamp-2 ${isOwn ? 'text-emerald-100' : 'text-gray-600 dark:text-gray-400'}`}>{m.metadata.description}</p>
                                        <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${isOwn ? 'text-emerald-200' : 'text-gray-500 dark:text-gray-500'}`}>
                                          <Info className="w-3 h-3" /> {new URL(m.metadata.url).hostname}
                                        </div>
                                      </div>
                                    </a>
                                  )}
                                </div>
                          }
                            </>
                        }
                        </div>
                        
                        {/* Timestamp is tucked natively into the bottom corner absolute */}

                        <div className="absolute bottom-1.5 right-3 flex items-center justify-end gap-1.5">
                          {m.isBurn && m.expiresAt ? (
                            <BurnTimer expiresAt={m.expiresAt} onExpire={() => {
                               setMessages(prev => prev.filter(msg => msg._id !== m._id));
                            }} />
                          ) : null}
                          <span
                          className={`text-[9px] font-semibold tracking-wide cursor-default ${isOwn ? 'text-white/60' : 'text-gray-500/80 dark:text-gray-400/80'}`}
                          title={m.createdAt ? format(new Date(m.createdAt), 'PPP p') : ''}>
                          
                            {formatSafeTime(m.createdAt)}
                          </span>
                          {isOwn && !m.isDeleted &&
                        <motion.span
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className={`transition-all duration-300 flex items-center ${
                          m.status === 'read' ? 'text-[#34b7f1]' : 'text-white/40'}`
                          }
                          title={m.status.charAt(0).toUpperCase() + m.status.slice(1)}>
                          
                              {m.status === 'sent' ?
                          <Check className="w-3.5 h-3.5 stroke-[2.5px]" /> :

                          <CheckCheck className={`w-3.5 h-3.5 stroke-[2.5px] ${m.status === 'read' ? 'drop-shadow-[0_0_2px_rgba(52,183,241,0.4)]' : ''}`} />
                          }
                            </motion.span>
                        }
                        </div>
                        {/* Tucked Reactions Display - Superior Glassmorphism & Logic */}
                        {m.reactions?.length > 0 &&
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`absolute -bottom-2.5 ${isOwn ? 'right-4' : 'left-4'} flex items-center gap-1 z-30`}
                          >
                            {Object.entries(
                              m.reactions.reduce((acc, curr) => {
                                acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([emoji, count]) => (
                              <button 
                                key={emoji} 
                                onClick={(e) => { e.stopPropagation(); handleReaction(m._id, emoji); }}
                                className={`flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] transition-all backdrop-blur-xl shadow-lg border hover:scale-110 active:scale-90 ${isOwn ? 'bg-black/20 border-white/10 text-white shadow-emerald-900/20' : 'bg-white/80 dark:bg-black/30 border-white/50 dark:border-white/10 text-gray-800 dark:text-gray-100 shadow-black/5'}`}>
                                <span className="drop-shadow-sm">{emoji}</span>
                                {count > 1 && <span className="text-[10px] opacity-90 font-bold">{count}</span>}
                              </button>
                            ))}
                          </motion.div>
                        }
                      </div>
                    </motion.div>
                  </React.Fragment>);

            })}
            </AnimatePresence>
          }
          <div ref={messagesEndRef} />
          {typingUsers.length > 0 &&
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mt-2 mb-2 relative z-10">
            
              <div className="bg-white dark:bg-[#1e293b] px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 transition-colors duration-300">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium italic">
                  {typingUsers.length === 1 ?
                `${typingUsers[0].name} is typing...` :
                typingUsers.length === 2 ?
                `${typingUsers[0].name} and ${typingUsers[1].name} are typing...` :
                `${typingUsers.length} people are typing...`}
                </span>
              </div>
            </motion.div>
          }
        </div>
      </div>

      {/* Input Section - Flex Bottom */}
      <div className="w-full flex justify-center z-40 px-3 md:px-8 pb-4 md:pb-8 pt-2 pointer-events-none bg-transparent">
        <div className="w-full max-w-[950px] bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-gray-100/50 dark:border-gray-700/50 rounded-[28px] p-2 md:p-3 flex flex-col relative pointer-events-auto transition-colors duration-300 ring-1 ring-black/5 dark:ring-white/5">
          <AnimatePresence>
            {showEmojiPicker &&
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-4 z-50">
              <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 z-10 p-1 bg-white/80 dark:bg-[#1e293b]/80 hover:bg-white dark:hover:bg-[#1e293b] rounded-full shadow-sm">
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                <EmojiPicker onEmojiClick={onEmojiClick} theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT} />
              </div>
            </motion.div>
          }
        </AnimatePresence>

        {/* AI Smart Replies Suggestions */}
        <AnimatePresence>
          {smartReplies.length > 0 &&
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 mb-3 overflow-x-auto custom-scrollbar pb-1">
              <Sparkles className="w-4 h-4 text-[#38bdf8] flex-shrink-0" />
              {smartReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(null, reply)}
                  className="px-4 py-1.5 bg-emerald-50 dark:bg-[#38bdf8]/10 hover:bg-emerald-100 dark:hover:bg-[#38bdf8]/20 border border-emerald-100 dark:border-[#38bdf8]/30 text-[#38bdf8] text-sm rounded-full whitespace-nowrap transition-colors shadow-sm font-medium">
                  {reply}
                </button>
              ))}
              <button onClick={() => setSmartReplies([])} className="p-1 hover:bg-gray-100 dark:hover:bg-[#334155] rounded-full text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          }
        </AnimatePresence>

        {/* Replying-To Context Banner */}
        <AnimatePresence>
          {replyingTo &&
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-50 dark:bg-[#334155] border-l-4 border-[#0ea5e9] rounded-t-xl px-4 py-3 mb-1 flex items-center justify-between">
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-[#0ea5e9] mb-0.5">Replying to {replyingTo.sender?.name || 'Someone'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{replyingTo.text || (replyingTo.fileUrl ? 'File attachment' : 'Message')}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#475569] rounded-full text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          }
        </AnimatePresence>
        
        <div className={`flex items-center gap-2 md:gap-3 bg-transparent rounded-[24px] p-1 transition-all duration-300 border border-transparent focus-within:bg-transparent ${replyingTo ? 'rounded-tl-none border-t-0' : ''}`}>
          {isRecording ?
          <div className="flex-1 flex items-center justify-between rounded-full px-4 py-2 transition-colors duration-300">
              <div className="flex items-center gap-3 text-red-500 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={cancelRecording} className="text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={stopRecording} className="p-2 bg-[#0ea5e9] text-white rounded-full hover:bg-[#0284c7] transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div> :
            <>
              <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'bg-black/5 text-[#38bdf8]' : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <Smile className="w-6 h-6" />
              </button>

              <label className="p-2 rounded-full cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
              <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2">
                <input
                type="text"
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-transparent text-[15px] focus:outline-none dark:text-gray-100 dark:placeholder-gray-500 transition-colors duration-300 placeholder-gray-400"
                value={newMessage}
                onChange={typingHandler}
                onFocus={() => setShowEmojiPicker(false)} />
              
                {isListening &&
              <button
                type="button"
                onClick={stopVoiceToText}
                className="p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors animate-pulse shadow-sm"
                title="Stop listening">
                
                    <Square className="w-5 h-5" />
                  </button>
              }
                {newMessage.trim() || uploading ?
              <button
                type="submit"
                disabled={!newMessage.trim() && !uploading}
                className="p-2.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-300 disabled:opacity-50">
                
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                  </button> :
              !isListening &&
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-all duration-300 active:scale-95">
                
                    <Mic className="w-6 h-6" />
                  </button>
              }
              </form>
            </>
          }
        </div>
      </div>
    </div>

      {/* Forward Modal */}
      {showForwardModal &&
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800 transition-colors duration-300">
          
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#f8fafc] dark:bg-[#1e293b]">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Forward Message</h3>
              <button
              onClick={() => setShowForwardModal(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-[#475569] rounded-full transition-colors">
              
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
              <div className="p-2 text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                Select a chat to forward to
              </div>
              {chats.filter((c) => c._id !== selectedChat?._id).map((chat) => {
              const sender = chat.isGroup ? { name: chat.name } : chat.participants[0]._id === user?._id ? chat.participants[1] : chat.participants[0];
              return (
                <button
                  key={chat._id}
                  onClick={() => handleForward(chat._id)}
                  disabled={forwarding}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-[#334155] rounded-xl transition-colors text-left group">
                  
                    <img
                    src={chat.isGroup ? `https://ui-avatars.com/api/?name=${chat.name}&background=random` : sender?.profilePic || `https://ui-avatars.com/api/?name=${sender?.name}`}
                    alt={sender?.name}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-gray-700"
                    referrerPolicy="no-referrer" />
                  
                    <div className="flex-1 overflow-hidden">
                      <div className="font-semibold text-gray-800 dark:text-gray-100 truncate group-hover:text-[#0ea5e9] transition-colors">
                        {chat.isGroup ? chat.name : sender?.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {chat.isGroup ? `${chat.participants.length} members` : 'Direct Message'}
                      </div>
                    </div>
                    {forwarding &&
                  <Loader2 className="w-4 h-4 animate-spin text-[#0ea5e9]" />
                  }
                  </button>);

            })}
              {chats.length <= 1 &&
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No other chats available to forward to.
                </div>
            }
            </div>
          </motion.div>
        </div>
      }

      <GroupInfo
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        fetchAgain={fetchAgain}
        setFetchAgain={setFetchAgain} 
      />

      <AnimatePresence>
        {showContactInfo && !selectedChat.isGroup && (
          <ContactInfoModal 
            isOpen={showContactInfo} 
            onClose={() => setShowContactInfo(false)} 
            user={sender} 
          />
        )}

        {showVideoCall && (
          <VideoCallInterface 
             socket={socket}
             remoteUserId={receivingCall ? callDetails?.from : sender?._id}
             remoteUserName={receivingCall ? callDetails?.callerName : sender?.name}
             remoteUserPic={sender?.profilePic}
             isIncoming={receivingCall}
             incomingSignal={incomingSignal}
             onEndCall={() => {
               setShowVideoCall(false);
               setReceivingCall(false);
               setIncomingSignal(null);
               setCallDetails(null);
             }}
          />
        )}
      </AnimatePresence>
    </div>);

};

export default ChatWindow;
