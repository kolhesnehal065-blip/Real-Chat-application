import React, { createContext, useContext, useState, useEffect } from 'react';











const ChatContext = createContext(undefined);

export const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [notification, setNotification] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('chat_notifications', JSON.stringify(notification));
  }, [notification]);

  const clearNotifications = (chatId) => {
    setNotification((prev) => prev.filter((n) => n.conversation._id !== chatId));
  };

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        chats,
        setChats,
        notification,
        setNotification,
        clearNotifications
      }}>
      
      {children}
    </ChatContext.Provider>);

};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
