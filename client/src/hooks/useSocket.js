import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';

const ENDPOINT = window.location.origin;

export const useSocket = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?._id) return;

    const newSocket = io(ENDPOINT);
    const handleConnect = () => {
      newSocket.emit('setup', user._id);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('reconnect', handleConnect);
    setSocket(newSocket);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('reconnect', handleConnect);
      newSocket.disconnect();
    };
  }, [user?._id]);

  return socket;
};
