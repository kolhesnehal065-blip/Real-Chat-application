import React, { useState } from 'react';

import { useChat } from '../../context/ChatContext.jsx';
import api from '../../services/api.js';
import { X, Search, Loader2, UserPlus, Camera, Plus } from 'lucide-react';
import { motion } from 'motion/react';

const GroupChatModal = ({ onClose }) => {
  const [groupName, setGroupName] = useState('');
  const [groupPic, setGroupPic] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const { chats, setChats, setSelectedChat } = useChat();

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) return;
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

  const handleGroup = (userToAdd) => {
    if (selectedUsers.includes(userToAdd)) return;
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleDelete = (delUser) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData);
      setGroupPic(data.url);
    } catch (error) {
      console.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!groupName || selectedUsers.length < 2) {
      console.error('Please fill all fields and select at least 2 users');
      return;
    }
    try {
      const { data } = await api.post('/chats/group', {
        name: groupName,
        users: JSON.stringify(selectedUsers.map((u) => u._id)),
        groupPic: groupPic
      });
      setChats([data, ...chats]);
      setSelectedChat(data);
      onClose();
    } catch (error) {
      console.error('Failed to create group');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300">
        
        <div className="p-4 bg-[#f8fafc] dark:bg-[#1e293b] flex items-center justify-between border-b border-gray-200 dark:border-gray-800 transition-colors duration-300 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Create Group Chat</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-[#475569] rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#334155] flex items-center justify-center">
                {groupPic ?
                <img src={groupPic} alt="Group" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> :

                <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                }
                {uploading &&
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                }
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-[#0ea5e9] text-white rounded-full cursor-pointer hover:bg-[#0284c7] transition-colors shadow-lg">
                <Plus className="w-4 h-4" />
                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Group Icon (Optional)</p>
          </div>

          <input
            type="text"
            placeholder="Chat Name"
            className="w-full px-4 py-2 bg-gray-50 dark:bg-[#334155] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] dark:text-gray-100 dark:placeholder-gray-500 transition-colors duration-300"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)} />
          

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Add Users (e.g. John, Jane)"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#334155] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] dark:text-gray-100 dark:placeholder-gray-500 transition-colors duration-300"
              onChange={(e) => handleSearch(e.target.value)} />
            
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((u) =>
            <div key={u._id} className="flex items-center gap-1 px-3 py-1 bg-[#0ea5e9]/10 dark:bg-[#0ea5e9]/20 text-[#0ea5e9] rounded-full text-xs font-semibold">
                {u.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => handleDelete(u)} />
              </div>
            )}
          </div>

          <div className="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar">
            {loading ?
            <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#0ea5e9]" />
              </div> :

            searchResult.
            filter((u) => !selectedUsers.find((sel) => sel._id === u._id)).
            slice(0, 4).
            map((u) =>
            <div
              key={u._id}
              onClick={() => handleGroup(u)}
              className="p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-[#334155] cursor-pointer rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
              
                  <img src={u.profilePic || `https://ui-avatars.com/api/?name=${u.name}`} className="w-8 h-8 rounded-full" alt={u.name} referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold dark:text-gray-100">{u.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{u.email}</p>
                  </div>
                  <UserPlus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </div>
            )
            }
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-3 bg-[#0ea5e9] text-white font-bold rounded-xl hover:bg-[#0284c7] transition-colors shadow-lg shadow-[#0ea5e9]/20">
            
            Create Group
          </button>
        </div>
      </motion.div>
    </div>);

};

export default GroupChatModal;
