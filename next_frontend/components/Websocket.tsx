'use client';

import useStore from '@/data/store';
import { useLoginToken } from '@/hooks/useAuth';
import { useEffect } from 'react';

const WebSocketComponent = () => {
  const { assuranceCase } = useStore();
  const [token] = useLoginToken();

  useEffect(() => {
    if (!assuranceCase?.id || !token) return;

    const socket = new WebSocket(`wss://staging-eap-backend.azurewebsites.net/ws/case/${assuranceCase.id}/?token=${token}`);

    socket.onopen = () => {
      console.log('Connected to WebSocket');
      // Optionally send a ping or connect message
      socket.send(JSON.stringify({ type: 'ping' }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Message received:', data);
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
    };

    socket.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    // Cleanup function to ensure proper disconnection
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'disconnect' })); // Optional: Inform the server about the disconnect
      }
      socket.close();
    };
  }, [assuranceCase?.id, token]);

  return null;
};

export default WebSocketComponent;
