'use client'

import io from 'socket.io-client';
import { useEffect, useState } from 'react';

const WebSocket = () => {
  // const [messages, setMessages] = useState<any>([]);

  useEffect(() => {
    console.log("Connecting to WebSocket...")
    const socket = io('ws://localhost:80/1', {
      transports: ['websocket'],  // Specify transports if needed
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    socket.on('message', (message) => {
      console.log('Message from server ', message);
      // setMessages((prevMessages: any) => [...prevMessages, message]);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <h1>WebSocket Messages</h1>
      {/* <ul>
        {messages.map((message: string, index: number) => (
          <li key={index}>{message}</li>
        ))}
      </ul> */}
    </div>
  );
};

export default WebSocket;
