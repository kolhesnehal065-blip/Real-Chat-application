import React, { useState, useEffect } from 'react';
import { Mail, Globe, MapPin, X, Info } from 'lucide-react';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext';

const ContactInfoModal = ({ isOpen, onClose, user }) => {
  const { auth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user) return;
    
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/auth/users/${user._id}`);
        setProfile(data);
      } catch (error) {
        console.error("Error fetching user profile", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isOpen, user, auth.token]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm transition-opacity">
      <div 
        className="w-full max-w-sm h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col pt-safe-top overflow-y-auto animate-slide-in-right border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800/50 backdrop-blur-xl sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Contact Info</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-24 h-24 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin"></div>
            <p className="text-slate-400 font-medium">Fetching details...</p>
          </div>
        ) : profile ? (
          <div className="flex flex-col">
            {/* Avatar Section */}
            <div className="p-8 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/50">
              <div className="relative group mb-4">
                <div className="w-32 h-32 rounded-full overflow-hidden shadow-xl ring-4 ring-white dark:ring-slate-800">
                  <img 
                    src={profile.profilePic || `https://ui-avatars.com/api/?name=${profile.name}&background=6366f1&color=fff&size=200`} 
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {profile.isOnline && (
                  <div className="absolute bottom-1 right-3 w-5 h-5 bg-green-500 rounded-full border-4 border-white dark:border-slate-900 shadow-sm"></div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-1">{profile.name}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{profile.email}</p>
            </div>

            {/* Info Section */}
            <div className="p-6 space-y-6">
              
              {/* Bio */}
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">About</h4>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-[15px] leading-relaxed">
                    {profile.bio || "Hi there! I am using RealChatX."}
                  </p>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-xl transition-colors cursor-pointer group">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Email Address</p>
                    <p className="text-sm text-slate-500">{profile.email}</p>
                  </div>
                </div>

                {profile.website && (
                  <div className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded-xl transition-colors cursor-pointer group">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Website</p>
                      <a href={profile.website.includes('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-500 hover:underline">{profile.website}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400">Could not load profile.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactInfoModal;
