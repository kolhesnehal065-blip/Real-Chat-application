import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import api from '../../services/api.js';
import { Search, Plus, LogOut, User, Check, CheckCheck, Loader2, FileText, Download, Upload, Trash2, Sun, Moon, MoreVertical, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GroupChatModal from './GroupChatModal.jsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext.jsx';

const Sidebar = ({ fetchAgain, socket, closeMobileSidebar }) => {
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { user, logout, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { chats, setChats, setSelectedChat, selectedChat, notification, setNotification, clearNotifications } = useChat();
  const selectedChatRef = React.useRef(selectedChat);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    twitter: '',
    linkedin: '',
    instagram: '',
    facebook: ''
  });

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setWebsite(user.website || '');
      setSocialLinks({
        twitter: user.socialLinks?.twitter || '',
        linkedin: user.socialLinks?.linkedin || '',
        instagram: user.socialLinks?.instagram || '',
        facebook: user.socialLinks?.facebook || ''
      });
    }
  }, [user]);

  const playNotificationSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch((e) => console.log('Audio play failed', e));
  };

  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const { data: { publicKey } } = await api.get('/notifications/vapid-public-key');

        if (!publicKey) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey
        });

        await api.post('/notifications/subscribe', subscription);
        console.log('Push subscribed');
      } catch (error) {
        console.error('Push subscription failed', error);
      }
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') subscribeToPush();
        });
      } else if (Notification.permission === 'granted') {
        subscribeToPush();
      }
    }
  }, []);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    if (selectedChat) {
      localStorage.setItem('lastActiveChatId', selectedChat._id);
    }
  }, [selectedChat]);

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUpdatingProfile(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data: uploadData } = await api.post('/upload', formData);

      if (!uploadData || !uploadData.url) {
        throw new Error('Upload failed: No URL returned');
      }

      const { data: updatedUser } = await api.put('/auth/profile', {
        profilePic: uploadData.url
      });

      if (!updatedUser) {
        throw new Error('Profile update failed: No user data returned');
      }

      setUser(prev => {
        const merged = { ...prev, ...updatedUser };
        localStorage.setItem('userInfo', JSON.stringify(merged));
        return merged;
      });
    } catch (error) {
      console.error('Profile picture update failed:', error.response?.data?.message || error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setUpdatingProfile(true);
      const payload = {
        bio,
        website,
        socialLinks
      };

      const { data: updatedUser } = await api.put('/auth/profile', payload);

      if (!updatedUser) {
        throw new Error('Profile update failed: No user data returned');
      }

      setUser(prev => {
        const merged = { ...prev, ...updatedUser };
        localStorage.setItem('userInfo', JSON.stringify(merged));
        return merged;
      });
      setIsProfileEditorOpen(false);
    } catch (error) {
      console.error('Profile update failed:', error.response?.data?.message || error.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const generateActivityReport = () => {
    if (!chats || chats.length === 0) return;

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('RealChatX Activity Report', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`User: ${user?.name}`, 20, 35);
    doc.text(`Email: ${user?.email}`, 20, 42);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 20, 49);

    const tableData = chats.map((chat) => {
      const sender = !chat.isGroup && chat.participants ? getSender(user, chat.participants) : null;
      const chatName = chat.isGroup ? chat.groupName : sender?.name;
      const lastMsg = chat.lastMessage ? chat.lastMessage.text || '[File]' : 'No messages';
      const lastTime = chat.lastMessage ? formatSafeTime(chat.lastMessage.createdAt || chat.lastMessage.updatedAt) : 'N/A';

      return [chatName, chat.isGroup ? 'Group' : 'Private', lastMsg, lastTime];
    });

    autoTable(doc, {
      startY: 60,
      head: [['Chat Name', 'Type', 'Last Message', 'Time']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [37, 211, 102] }
    });

    doc.save(`ActivityReport_${user?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleBackup = async () => {
    try {
      const { data } = await api.get('/chats/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RealChatX_Backup_${user?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup failed');
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result);
        await api.post('/chats/restore', backupData);
        alert('Backup restored successfully!');
        fetchChats();
      } catch (error) {
        console.error('Restore failed');
        alert('Failed to restore backup. Please ensure the file is valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(normalizeChat(chat));
    clearNotifications(chat._id);
    if (closeMobileSidebar) closeMobileSidebar();
  };

  const fetchChats = async () => {
    try {
      const { data } = await api.get(`/chats?t=${Date.now()}`);
      if (Array.isArray(data)) {
        const normalizedChats = data.map(normalizeChat);
        setChats(normalizedChats);

        normalizedChats.forEach((chat) => {
          socket?.emit('join_chat', chat._id);
          // Mark as delivered for all chats on load
          api.put(`/messages/${chat._id}/delivered`).catch(() => {});
          socket?.emit('message_delivered', { chatId: chat._id, userId: user?._id });
        });
        // Request current online users after loading chats
        socket?.emit('request_online_users');
      } else {
        console.error('Expected array for chats, got:', data);
        setChats([]);
      }
    } catch (error) {
      console.error('Failed to fetch chats');
      setChats([]);
    }
  };

  useEffect(() => {
    fetchChats();
  }, [fetchAgain, socket]);

  useEffect(() => {
    if (!socket) return;

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

    const handleMessageStatusUpdated = (data) => {
      // Only update status if it was triggered by someone else
      if (String(data.userId) === String(user?._id)) return;

      setChats((prevChats) =>
      prevChats.map((chat) => {
        if (String(chat._id) === String(data.chatId) && chat.lastMessage) {
          const statusPriority = { sent: 1, delivered: 2, read: 3 };
          const currentPriority = statusPriority[chat.lastMessage.status] || 0;
          const newPriority = statusPriority[data.status] || 0;
          if (newPriority > currentPriority) {
            return {
              ...chat,
              lastMessage: { ...chat.lastMessage, status: data.status }
            };
          }
        }
        return chat;
      })
      );
    };

    const handleMessageReceived = (newMessageReceived) => {
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => String(c._id) === String(newMessageReceived.conversation._id));
        if (chatIndex !== -1) {
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex],
            lastMessage: newMessageReceived,
            updatedAt: new Date().toISOString()
          };
          return updatedChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        return prevChats;
      });

      // Handle notification
      if (!selectedChatRef.current || selectedChatRef.current._id !== newMessageReceived.conversation._id) {
        setNotification((prev) => [newMessageReceived, ...prev]);
        playNotificationSound();

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const senderName = newMessageReceived.sender.name;
          const chatName = newMessageReceived.conversation.isGroup ?
          newMessageReceived.conversation.groupName :
          senderName;

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(chatName, {
                body: newMessageReceived.isSystem ? newMessageReceived.text : `${senderName}: ${newMessageReceived.text || 'Sent a file'}`,
                icon: newMessageReceived.sender.profilePic || '/logo.png',
                tag: newMessageReceived.conversation._id,
                renotify: true
              });
            });
          } else {
            new Notification(chatName, {
              body: newMessageReceived.isSystem ? newMessageReceived.text : `${senderName}: ${newMessageReceived.text || 'Sent a file'}`,
              icon: newMessageReceived.sender.profilePic || '/logo.png',
              tag: newMessageReceived.conversation._id
            });
          }
        }
      }

      // Emit delivered
      socket.emit('message_delivered', { chatId: newMessageReceived.conversation._id, userId: user?._id });
    };

    const handleChatMetadataUpdated = (updatedChat) => {
      setChats((prevChats) => {
        if (updatedChat.isRemoved) {
          return prevChats.filter((c) => c._id !== updatedChat._id);
        }
        const chatIndex = prevChats.findIndex((c) => c._id === updatedChat._id);
        if (chatIndex !== -1) {
          const updatedChats = [...prevChats];
          updatedChats[chatIndex] = {
            ...updatedChats[chatIndex],
            ...updatedChat
          };
          return updatedChats;
        } else {
          return [updatedChat, ...prevChats];
        }
      });

      if (selectedChatRef.current?._id === updatedChat._id) {
        if (updatedChat.isRemoved) {
          setSelectedChat(null);
        } else {
          setSelectedChat(updatedChat);
        }
      }
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('message_status_updated', handleMessageStatusUpdated);
    socket.on('message_received', handleMessageReceived);
    socket.on('chat_metadata_updated', handleChatMetadataUpdated);

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('message_status_updated', handleMessageStatusUpdated);
      socket.off('message_received', handleMessageReceived);
      socket.off('chat_metadata_updated', handleChatMetadataUpdated);
    };
  }, [socket, user?._id]);

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get(`/auth?search=${query}`);
      if (Array.isArray(data)) {
        setSearchResult(data);
      } else {
        console.error('Expected array for search results, got:', data);
        setSearchResult([]);
      }
    } catch (error) {
      console.error('Search failed');
      setSearchResult([]);
    } finally {
      setLoading(false);
    }
  };

  const accessChat = async (userId, searchUser) => {
    try {
      const { data } = await api.post('/chats', { userId });
      const chatData = normalizeChat(data);

      if (!chats.find((c) => String(c._id) === String(chatData._id))) {
        setChats([chatData, ...chats]);
      }
      setSelectedChat(chatData);
      clearNotifications(chatData._id);
      setSearch('');
      setSearchResult([]);
      if (closeMobileSidebar) closeMobileSidebar();
    } catch (error) {
      console.error('Error accessing chat');
    }
  };

  const getSender = (loggedUser, participants) => {
    if (!participants || participants.length < 2) return null;
    const loggedUserId = String(loggedUser?._id);
    const otherParticipant = participants.find((participant) => String(participant._id) !== loggedUserId);
    return otherParticipant || participants[0];
  };

  const formatSafeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const normalizeChat = (chat) => {
    if (!chat) return chat;

    if (chat.isGroup) {
      return {
        ...chat,
        displayName: chat.groupName || chat.displayName || 'Group Chat',
        displayPic: chat.groupPic || chat.displayPic || ''
      };
    }

    // For direct chats - trust the displayName from backend
    return chat;
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#0f172a] shadow-[4px_0_24px_rgba(0,0,0,0.06)] relative z-20 transition-colors duration-300">
      {/* Header */}
      <div className="relative z-[1000] p-4 flex items-center justify-between border-b border-transparent transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <img
              src={user?.profilePic || `https://ui-avatars.com/api/?name=${user?.name}`}
              alt="Profile"
              className={`w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600 transition-opacity ${updatingProfile ? 'opacity-50' : 'group-hover:opacity-70'}`}
              referrerPolicy="no-referrer" />
            
            {updatingProfile ?
            <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-[#0ea5e9]" />
              </div> :

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-4 h-4 text-white drop-shadow-md" />
              </div>
            }
            <input
              type="file"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleProfilePicUpload}
              accept="image/*"
              disabled={updatingProfile}
              title="Change Profile Picture" />
            
          </div>
          <div>
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-emerald-600 dark:from-emerald-400 dark:to-emerald-400 text-xl tracking-tight">RealChatX</span>
            {user?.bio && <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{user.bio}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 relative">
          <button onClick={() => setShowModal(true)} className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-full transition-all duration-300 shadow-sm hover:shadow active:scale-95" title="New Chat">
            <Plus className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className={`p-2 rounded-full transition-all duration-300 active:scale-95 ${showSettingsMenu ? 'bg-black/5 dark:bg-white/5 text-gray-900 dark:text-gray-100' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-500'}`}
            title="Menu">
            <MoreVertical className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showSettingsMenu && (
              <>
                {/* Full-screen Overlay */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[900] bg-black/5 dark:bg-black/40 backdrop-blur-[1px]" 
                  onClick={() => setShowSettingsMenu(false)}
                />

                {/* Dropdown Menu */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white/95 dark:bg-[#1a232c]/95 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] py-2 z-[1000] border border-white/50 dark:border-white/5 backdrop-blur-3xl origin-top-right"
                >
                  <button onClick={() => { setIsProfileEditorOpen(true); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-[14px] flex items-center gap-3 transition-colors font-medium">
                    <User className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Edit Profile
                  </button>
                  <button onClick={() => { toggleTheme(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-[14px] flex items-center gap-3 transition-colors font-medium">
                    {theme === 'light' ? <Moon className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <Sun className="w-4 h-4 text-gray-400 dark:text-gray-500" />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                  </button>
                  <div className="my-1.5 border-t border-black/5 dark:border-white/5"></div>
                  <button onClick={() => { handleBackup(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-[14px] flex items-center gap-3 transition-colors font-medium">
                    <Download className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Backup Data
                  </button>
                  <div className="relative group w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-[14px] flex items-center gap-3 transition-colors cursor-pointer overflow-hidden font-medium">
                    <Upload className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Restore Data
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { handleRestore(e); setShowSettingsMenu(false); }} accept=".json" />
                  </div>
                  <button onClick={() => { generateActivityReport(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-200 text-[14px] flex items-center gap-3 transition-colors font-medium">
                    <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Activity Report
                  </button>
                  <div className="my-1.5 border-t border-black/5 dark:border-white/5"></div>
                  <button onClick={() => { logout(); setShowSettingsMenu(false); }} className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 text-[14px] flex items-center gap-3 transition-colors font-bold">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isProfileEditorOpen &&
      <div className="p-4 bg-[#f7f7f7] dark:bg-[#0f1720] border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Profile Settings</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Update your bio, website, and social links.</p>
            </div>
            <button
            onClick={() => setIsProfileEditorOpen(false)}
            className="text-sm text-[#0ea5e9] hover:text-[#0284c7] transition-colors">
            
              Close
            </button>
          </div>
          <label className="block mb-3 text-sm text-gray-700 dark:text-gray-300">
            Bio
            <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 w-full min-h-[80px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
            placeholder="Tell people a little about yourself" />
          
          </label>
          <label className="block mb-3 text-sm text-gray-700 dark:text-gray-300">
            Website
            <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
            placeholder="https://example.com" />
          
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Twitter
              <input
              value={socialLinks.twitter}
              onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
              placeholder="Twitter URL" />
            
            </label>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              LinkedIn
              <input
              value={socialLinks.linkedin}
              onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
              placeholder="LinkedIn URL" />
            
            </label>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Instagram
              <input
              value={socialLinks.instagram}
              onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
              placeholder="Instagram URL" />
            
            </label>
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Facebook
              <input
              value={socialLinks.facebook}
              onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f172a] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
              placeholder="Facebook URL" />
            
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
            onClick={handleSaveProfile}
            disabled={updatingProfile}
            className="px-4 py-2 rounded-lg bg-[#0ea5e9] text-white hover:bg-[#0284c7] disabled:opacity-60">
            
              Save Profile
            </button>
            <button
            onClick={() => setIsProfileEditorOpen(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#17202a]">
            
              Cancel
            </button>
          </div>
        </div>
      }

      {/* Search */}
      <div className="px-4 py-3 bg-transparent transition-colors duration-300">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="w-full pl-11 pr-4 py-3 bg-black/5 dark:bg-white/5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:text-slate-100 dark:placeholder-slate-400 transition-all shadow-sm border border-black/5 dark:border-white/5"
            value={search}
            onChange={(e) => handleSearch(e.target.value)} />
          
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {search ?
          Array.isArray(searchResult) && searchResult.map((u) =>
          <motion.div
            key={u._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={() => accessChat(u._id, u)}
            className="p-3 mx-3 my-1.5 flex flex-row items-center gap-4 hover:bg-white/80 dark:hover:bg-white/5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 cursor-pointer transition-all duration-300 rounded-[1.5rem] border border-transparent hover:border-white/40 dark:hover:border-white/10">
            
                <img
              src={u.profilePic || `https://ui-avatars.com/api/?name=${u.name}`}
              className="w-12 h-12 rounded-full"
              alt={u.name}
              referrerPolicy="no-referrer" />
            
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100">{u.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                </div>
              </motion.div>
          ) :

          Array.isArray(chats) && chats.map((chat) => {
            const sender = !chat.isGroup ? getSender(user, chat.participants) : null;
            const isActive = selectedChat?._id === chat._id;
            const unreadCount = notification.filter((n) => n.conversation._id === chat._id).length;

            return (
              <motion.div
                key={chat._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => handleSelectChat(chat)}
                className={`p-3 mx-3 my-2 flex items-center gap-4 cursor-pointer transition-all duration-300 rounded-2xl border ${
                isActive ? 'bg-white/80 dark:bg-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] border-emerald-100 dark:border-white/10 backdrop-blur-xl scale-[1.02]' : 
                (unreadCount > 0 ? 'bg-white/60 dark:bg-white/5 border-emerald-200/50 dark:border-emerald-500/30 hover:scale-[1.02] hover:shadow-md hover:bg-white/80 dark:hover:bg-white/10' : 'border-transparent hover:bg-white/40 dark:hover:bg-white/5 hover:scale-[1.02] hover:shadow-sm')}`
                }>
                
                  <div className="relative">
                    <div className={`p-[2px] rounded-[1.15rem] shadow-sm relative ${isActive ? 'bg-emerald-400/50 dark:bg-emerald-500/30' : 'bg-gradient-to-tr from-emerald-400 via-emerald-400 to-pink-400'}`}>
                      <img
                      src={chat.isGroup ?
                      chat.groupPic || chat.displayPic || `https://ui-avatars.com/api/?name=${chat.groupName || 'Group'}&background=random` :
                      chat.displayPic || `https://ui-avatars.com/api/?name=${chat.displayName || 'User'}`
                      }
                      className="w-12 h-12 rounded-[1rem] object-cover border-2 border-white dark:border-[#1e293b]"
                      alt="Avatar"
                      referrerPolicy="no-referrer" />
                    </div>
                  
                    {!chat.isGroup && sender?.isOnline &&
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                  }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`font-bold truncate text-[15px] leading-tight text-gray-900 dark:text-gray-50`}>
                        {chat.isGroup ?
                      chat.groupName || chat.displayName || 'Group Chat' :
                      chat.displayName || 'Unknown User'
                      }
                      </h3>
                      {chat.mutedBy && chat.mutedBy.includes(user?._id) && (
                        <BellOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mx-1 flex-shrink-0" />
                      )}
                      {chat.lastMessage &&
                    <span className={`text-[10px] ${unreadCount > 0 ? 'text-emerald-500 dark:text-emerald-400 font-bold' : (isActive ? 'text-gray-500 dark:text-gray-400' : 'text-slate-400 dark:text-slate-500')}`}>
                          {formatSafeTime(chat.lastMessage.createdAt || chat.lastMessage.updatedAt)}
                        </span>
                    }
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-[13px] truncate flex items-center gap-1 flex-1 font-medium ${isActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {chat.lastMessage ?
                      <>
                            {String(chat.lastMessage.sender._id) === String(user?._id) && !chat.lastMessage.isDeleted &&
                        <span
                          className={`transition-all duration-300 flex items-center ${
                          chat.lastMessage.status === 'read' ? 'text-[#34b7f1]' :
                          chat.lastMessage.status === 'delivered' ? 'text-gray-500' : 'text-gray-400'}`
                          }
                          title={chat.lastMessage.status.charAt(0).toUpperCase() + chat.lastMessage.status.slice(1)}>
                          
                                {chat.lastMessage.status === 'sent' ?
                          <Check className="w-3 h-3 stroke-[2.5px]" /> :

                          <CheckCheck className={`w-3 h-3 stroke-[2.5px] ${chat.lastMessage.status === 'read' ? 'drop-shadow-[0_0_1px_rgba(52,183,241,0.5)]' : ''}`} />
                          }
                              </span>
                        }
                            {!chat.lastMessage.isSystem && !chat.lastMessage.isDeleted && <span className={`font-semibold ${isActive ? 'text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}`}>{chat.lastMessage.sender.name}: </span>}
                            {chat.lastMessage.isDeleted ?
                        <span className="italic flex items-center gap-1 opacity-70"><Trash2 className="w-3 h-3" /> This message was deleted</span> :

                        <span className="truncate">{chat.lastMessage.text || 'Sent a file'}</span>
                        }
                          </> :

                      'No messages yet'
                      }
                      </p>
                      {unreadCount > 0 &&
                    <span className={`bg-emerald-500 text-white shadow-sm text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
                          {unreadCount}
                        </span>
                    }
                    </div>
                  </div>
                </motion.div>);

          })
          }
        </AnimatePresence>
      </div>

      {showModal && <GroupChatModal onClose={() => setShowModal(false)} />}
    </div>);

};

export default Sidebar;
