import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import api from '../../services/api.js';
import { X, Search, Loader2, UserPlus, UserMinus, LogOut, Camera, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GroupInfo = ({ isOpen, onClose, fetchAgain, setFetchAgain }) => {
  const [groupName, setGroupName] = useState('');
  const [groupPicFile, setGroupPicFile] = useState(null);
  const [previewPic, setPreviewPic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const { selectedChat, setSelectedChat, setChats } = useChat();

  useEffect(() => {
    if (selectedChat && isOpen) {
      setGroupName(selectedChat.groupName);
      setPreviewPic(selectedChat.groupPic);
      setGroupPicFile(null);
    }
  }, [selectedChat, isOpen]);

  const handleUpdateGroupDetails = async () => {
    if (!groupName && !groupPicFile) return;

    try {
      setUploading(true);
      let newPicUrl = selectedChat.groupPic;

      // Only format and push form data if pic actually altered
      if (groupPicFile) {
        const formData = new FormData();
        formData.append('file', groupPicFile);
        const { data: uploadData } = await api.post('/upload', formData);
        newPicUrl = uploadData.url;
      }

      const { data } = await api.put('/chats/group-update', {
        chatId: selectedChat._id,
        chatName: groupName !== selectedChat.groupName ? groupName : undefined,
        groupPic: newPicUrl !== selectedChat.groupPic ? newPicUrl : undefined
      });

      setSelectedChat(data);
      setChats(prev => prev.map(c => c._id === data._id ? { ...c, ...data, isGroup: true, displayName: data.groupName || data.displayName || 'Group Chat', displayPic: data.groupPic || data.displayPic || '' } : c));
      setFetchAgain(!fetchAgain);
      setGroupPicFile(null);
    } catch (error) {
      console.error('Failed to update group details');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateGroupPic = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGroupPicFile(file);
    setPreviewPic(URL.createObjectURL(file));
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get(`/auth?search=${query}`);
      setSearchResult(data);
    } catch (error) {
      console.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userToAdd) => {
    if (selectedChat.participants.find((u) => u._id === userToAdd._id)) return;
    if (selectedChat.groupAdmin._id !== user?._id) return;

    try {
      setLoading(true);
      const { data } = await api.put('/chats/groupadd', {
        chatId: selectedChat._id,
        userId: userToAdd._id
      });
      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
    } catch (error) {
      console.error('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userToRemove) => {
    if (selectedChat.groupAdmin._id !== user?._id && userToRemove._id !== user?._id) return;

    try {
      setLoading(true);
      const { data } = await api.put('/chats/groupremove', {
        chatId: selectedChat._id,
        userId: userToRemove._id
      });

      if (userToRemove._id === user?._id) {
        setSelectedChat(null);
        onClose();
      } else {
        setSelectedChat(data);
      }
      setFetchAgain(!fetchAgain);
    } catch (error) {
      console.error('Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  const isDirty = groupName !== selectedChat?.groupName || !!groupPicFile;

  return (
    <AnimatePresence>
      {isOpen && selectedChat && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Sliding Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] md:w-[440px] bg-white dark:bg-[#0f172a] z-[9999] shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col h-full overflow-hidden"
          >
            <div className="flex items-center gap-4 py-4 px-5 bg-gray-50 dark:bg-[#1e293b] border-b border-gray-200 dark:border-gray-800 shrink-0 shadow-sm z-10">
              <button 
                onClick={onClose} 
                className="p-1.5 md:p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <h2 className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-100">Group Info</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 bg-white dark:bg-[#0f172a]">
              <div className="flex flex-col items-center gap-3">
                <label className="relative group cursor-pointer block">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-transparent shadow-md bg-gray-100 dark:bg-[#334155] flex items-center justify-center group-hover:opacity-90 transition-opacity">
                    {previewPic ? (
                      <img src={previewPic} alt="Group" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Camera className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 p-2.5 bg-[#0ea5e9] text-white rounded-full transition-transform shadow-lg hover:scale-110">
                    <Camera className="w-4 h-4 md:w-5 md:h-5" />
                    <input type="file" className="hidden" onChange={handleUpdateGroupPic} accept="image/*" disabled={uploading} />
                  </div>
                </label>
              </div>

              <div className="px-4 py-4 bg-gray-50 dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#0ea5e9]"></div>
                <label className="text-[11px] md:text-xs font-bold text-[#0ea5e9] uppercase tracking-wide">Group Name</label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    className="w-full bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-[#0ea5e9] dark:focus:border-[#0ea5e9] outline-none text-gray-800 dark:text-gray-100 py-1 transition-colors font-medium text-base md:text-lg"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
              </div>

              {isDirty && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleUpdateGroupDetails}
                  disabled={uploading}
                  className="w-full py-3 bg-[#0ea5e9] bg-opacity-90 hover:bg-opacity-100 text-white font-bold rounded-xl shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </motion.button>
              )}

              <div className="px-4 py-4 bg-gray-50 dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <label className="text-[11px] md:text-xs font-bold text-[#0ea5e9] uppercase tracking-wide">Members ({selectedChat.participants.length})</label>
                <div className="mt-3 space-y-2">
                  {selectedChat.participants.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors group/item">
                      <div className="flex items-center gap-3">
                        <img src={u.profilePic || `https://ui-avatars.com/api/?name=${u.name}`} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-sm" alt={u.name} referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                            {u._id === user?._id ? 'You' : u.name} 
                            {u._id === selectedChat.groupAdmin._id && <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-[#0ea5e9]/10 text-[#0ea5e9] rounded-full border border-[#0ea5e9]/20">ADMIN</span>}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                      
                      {(selectedChat.groupAdmin._id === user?._id && u._id !== user?._id) && (
                        <button
                          onClick={() => handleRemoveUser(u)}
                          className="p-2 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all"
                          title="Remove user"
                        >
                          <UserMinus className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedChat.groupAdmin._id === user?._id && (
                <div className="px-4 py-4 bg-gray-50 dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <label className="text-[11px] md:text-xs font-bold text-[#0ea5e9] uppercase tracking-wide">Add Members</label>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#334155] border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-[#0ea5e9] text-sm md:text-base text-gray-800 dark:text-gray-200"
                      onChange={(e) => handleSearch(e.target.value)} 
                    />
                  </div>
                  
                  {search && (
                    <div className="mt-3 space-y-2">
                      {loading ? (
                        <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-[#0ea5e9]" /></div>
                      ) : (
                        searchResult.filter(u => !selectedChat.participants.find(p => p._id === u._id)).slice(0, 4).map((u) => (
                          <div
                            key={u._id}
                            onClick={() => handleAddUser(u)}
                            className="flex items-center gap-3 p-2 bg-white dark:bg-[#334155] hover:ring-2 hover:ring-[#0ea5e9]/50 cursor-pointer rounded-xl transition-all border border-gray-100 dark:border-gray-700 group/add"
                          >
                            <img src={u.profilePic || `https://ui-avatars.com/api/?name=${u.name}`} className="w-8 h-8 rounded-full" alt={u.name} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{u.name}</p>
                            </div>
                            <div className="p-1.5 transition-colors bg-[#0ea5e9]/10 text-[#0ea5e9] rounded-full mr-2">
                              <UserPlus className="w-4 h-4" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => handleRemoveUser(user)}
                className="w-full py-4 text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 rounded-2xl md:text-base mt-2 active:scale-95"
              >
                <LogOut className="w-5 h-5" />
                Exit Group
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GroupInfo;
