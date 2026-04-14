import React, { useState } from 'react';
import Sidebar from '../components/Chat/Sidebar.jsx';
import ChatWindow from '../components/Chat/ChatWindow.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useSocket } from '../hooks/useSocket.js';

const ChatPage = () => {
  const { selectedChat } = useChat();
  const socket = useSocket();
  const [fetchAgain, setFetchAgain] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-mesh-light dark:bg-mesh-dark overflow-hidden transition-colors duration-300 w-full font-sans p-0 md:p-6 lg:p-10 relative">      
      {/* Floating App Container */}
      <div className="w-full max-w-[1440px] h-[100dvh] md:h-[92vh] bg-white/50 dark:bg-slate-900/50 backdrop-blur-[40px] md:rounded-[2.5rem] shadow-none md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4),_inset_0_4px_8px_rgba(255,255,255,0.5),_inset_0_-8px_16px_rgba(0,0,0,0.1)] dark:md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7),_inset_0_4px_8px_rgba(255,255,255,0.1),_inset_0_-8px_16px_rgba(0,0,0,0.4)] border-0 md:border md:border-t-white dark:md:border-t-white/20 md:border-b-black/10 dark:md:border-b-black/50 flex overflow-hidden ring-0 md:ring-1 ring-white/60 dark:ring-white/5 relative z-10 transition-transform duration-500 hover:scale-[1.005] perspective-1000 transform-gpu">
        {/* ChatWindow wrapper */}
        <div className={`${showMobileSidebar ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 h-full w-full relative bg-transparent`}>
          {selectedChat ?
          <ChatWindow fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} socket={socket} toggleSidebar={() => setShowMobileSidebar(true)} /> :

          <div className="flex-1 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden bg-transparent">
              {/* Subtle Gradient Backdrops */}
              <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none animate-float-y"></div>
              <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none animate-float-y-delayed"></div>
              <div className="absolute top-[40%] right-[30%] w-[20%] h-[20%] rounded-full bg-pink-500/10 blur-[90px] pointer-events-none animate-float-y"></div>

              <div className="relative z-10 animate-float-y">
                <div className="w-48 h-48 mb-8 shadow-2xl rounded-3xl overflow-hidden ring-1 ring-white/40 dark:ring-white/10 backdrop-blur-md relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-emerald-500/20 mix-blend-overlay pointer-events-none"></div>
                  <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2000&auto=format&fit=crop" alt="Select a chat" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700 block" referrerPolicy="no-referrer" />
                </div>
              </div>

              <h2 className="relative z-10 text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-emerald-600 to-emerald-600 dark:from-emerald-400 dark:to-emerald-400 mb-4 drop-shadow-sm tracking-tight text-center px-4">
                Welcome to RealChatX
              </h2>
              
              <p className="relative z-10 text-slate-600 dark:text-slate-400 text-base md:text-lg max-w-sm text-center font-medium leading-relaxed px-6 mb-10">
                A seamless, premium communication experience. Select a contact to jump right in.
              </p>

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
                <button
                  className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)] hover:-translate-y-0.5 transition-all duration-300 md:hidden"
                  onClick={() => setShowMobileSidebar(true)}
                >
                  Open Contacts
                </button>
                <div className="hidden md:block px-8 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full font-semibold shadow-inner cursor-not-allowed">
                  Select a contact from the right
                </div>
              </div>
            </div>
          }
        </div>

        {/* Sidebar wrapper */ }
        <div className={`${showMobileSidebar ? 'flex' : 'hidden md:flex'} w-full md:w-[320px] lg:w-[25%] flex-shrink-0 z-30 relative shadow-[-4px_0_24px_rgba(0,0,0,0.04)] dark:shadow-[-4px_0_24px_rgba(0,0,0,0.2)] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-l border-white/40 dark:border-white/10`}>
          <Sidebar fetchAgain={fetchAgain} socket={socket} closeMobileSidebar={() => setShowMobileSidebar(false)} />
        </div>
      </div>
    </div>);
};

export default ChatPage;
