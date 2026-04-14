import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const VoiceMessagePlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    
    const setAudioData = () => {
      if (audio.duration && audio.duration !== Infinity) {
          setDuration(audio.duration);
      }
    };
    
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const setAudioEnd = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', setAudioEnd);
    
    // Fallback for duration if not instantly available
    audio.addEventListener('canplaythrough', setAudioData);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', setAudioEnd);
      audio.removeEventListener('canplaythrough', setAudioData);
    };
  }, []);

  const togglePlayPause = () => {
    const prevValue = isPlaying;
    setIsPlaying(!prevValue);
    if (!prevValue) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  };

  const handleProgressChange = (e) => {
    const audio = audioRef.current;
    audio.currentTime = e.target.value;
    setCurrentTime(e.target.value);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="inline-flex items-center gap-2 w-fit min-w-[160px] max-w-[220px] p-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button 
        onClick={togglePlayPause} 
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/30 backdrop-blur-md hover:bg-white/40 text-white shadow-sm border border-white/40 transition-all active:scale-95"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1 justify-center">
        {/* Custom Progress Bar / Range */}
        <div className="relative w-full h-1 bg-white/20 rounded-full flex items-center backdrop-blur-sm">
          <div 
            className="absolute left-0 h-1 bg-white/95 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none" 
            style={{ width: `${progressPercentage}%` }} 
          />
          <div 
            className="absolute h-2.5 w-2.5 bg-white rounded-full shadow-md border border-gray-100 transform -translate-x-1 pointer-events-none" 
            style={{ left: `${progressPercentage}%` }} 
          />
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleProgressChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        
        {/* Timestamp */}
        <div className="text-[11px] font-medium text-white/90 font-mono tracking-wide">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
