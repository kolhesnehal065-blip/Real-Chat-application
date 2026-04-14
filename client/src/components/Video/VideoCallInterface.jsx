import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneOff, MicOff, Mic, Video, VideoOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAssetUrl } from '../../utils/assetUrl.js';

const VideoCallInterface = ({ socket, remoteUserId, remoteUserName, remoteUserPic, isIncoming, incomingSignal, onEndCall }) => {
  const { auth } = useAuth();
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(isIncoming);
  const [callerName, setCallerName] = useState(remoteUserName || 'Someone');
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }

        if (!isIncoming) {
          // If we are calling, initiate the connection
          callUser(remoteUserId, currentStream);
        }
      })
      .catch((err) => console.error("Error accessing media devices", err));

    socket.on("call_accepted", (signal) => {
      setCallAccepted(true);
      if (connectionRef.current) {
        connectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on("ice_candidate", (candidate) => {
      if (connectionRef.current) {
        connectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("call_ended", () => {
      leaveCall();
    });

    return () => {
      socket.off("call_accepted");
      socket.off("ice_candidate");
      socket.off("call_ended");
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line
  }, []);

  const createPeer = (currentStream) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
      ]
    });

    if (currentStream) {
      currentStream.getTracks().forEach(track => peer.addTrack(track, currentStream));
    }

    peer.ontrack = (event) => {
      if (userVideo.current) {
        userVideo.current.srcObject = event.streams[0];
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", {
          to: remoteUserId,
          candidate: event.candidate
        });
      }
    };

    return peer;
  };

  const callUser = async (idToCall, currentStream) => {
    const peer = createPeer(currentStream);
    connectionRef.current = peer;

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("call_user", {
      userToCall: idToCall,
      signalData: offer,
      from: auth.user._id,
      callerName: auth.user.name,
      chatRoom: idToCall // using user ID routing context as room
    });
  };

  const answerCall = async () => {
    setCallAccepted(true);
    setReceivingCall(false);

    const peer = createPeer(stream);
    connectionRef.current = peer;

    if (incomingSignal) {
      await peer.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("answer_call", { signal: answer, to: remoteUserId });
    }
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    socket.emit("end_call", { to: remoteUserId });
    onEndCall();
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  return (
    <AnimatePresence>
      {!callEnded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 font-sans"
        >
          {/* Header */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
            <h2 className="text-white text-2xl font-semibold mb-2">
              {receivingCall && !callAccepted ? `Incoming call from ${callerName}...` : `In call with ${remoteUserName}`}
            </h2>
            <div className="text-gray-400 font-mono text-sm tracking-widest animate-pulse">
              {callAccepted ? '00:00 CONNECTED' : 'RINGING...'}
            </div>
          </div>

          {/* Videos Container */}
          <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 mt-16 flex items-center justify-center">
            
            {/* Receiver Video */}
            {callAccepted && !callEnded ? (
              <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden mb-6 ring-4 ring-[#0ea5e9]/50 shadow-2xl">
                  <img src={getAssetUrl(remoteUserPic) || `https://ui-avatars.com/api/?name=${remoteUserName}&background=6366f1&color=fff`} alt={callerName} className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-3xl font-bold tracking-tight mb-2">{remoteUserName}</div>
                <div className="text-emerald-400 font-medium">RealChatX Encrypted Call</div>
              </div>
            )}

            {/* My Local Video */}
            <div className={`absolute bottom-6 right-6 w-48 aspect-[3/4] bg-gray-800 rounded-2xl overflow-hidden shadow-2xl ring-2 ${isVideoOff ? 'ring-red-500/50' : 'ring-[#0ea5e9]/50'} transition-all z-10 duration-300`}>
              <video playsInline muted ref={myVideo} autoPlay className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <VideoOff className="w-8 h-8 text-gray-500" />
                </div>
              )}
            </div>
          </div>

          {/* Control Bar */}
          <div className="absolute bottom-12 flex items-center gap-6 bg-white/10 hover:bg-white/15 backdrop-blur-3xl px-8 py-4 rounded-full transition-colors border border-white/5">
            {receivingCall && !callAccepted ? (
              <>
                <button
                  onClick={answerCall}
                  className="bg-green-500 hover:bg-green-400 text-white p-4 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all hover:scale-110 active:scale-95 flex items-center gap-2 px-8 font-bold"
                >
                  <Video className="w-6 h-6" /> Accept
                </button>
                <button
                  onClick={leaveCall}
                  className="bg-red-500 hover:bg-red-400 text-white p-4 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:scale-110 active:scale-95 flex items-center gap-2 px-8 font-bold"
                >
                  <PhoneOff className="w-6 h-6" /> Decline
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all hover:scale-110 active:scale-95 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white'}`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                  onClick={leaveCall}
                  className="bg-red-500 hover:bg-red-400 text-white p-4 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all hover:scale-110 active:scale-95 mx-4"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full transition-all hover:scale-110 active:scale-95 ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white'}`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoCallInterface;
