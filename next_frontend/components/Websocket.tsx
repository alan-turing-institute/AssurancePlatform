'use client';

import useStore from '@/data/store';
import { useLoginToken } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { X } from 'lucide-react';

const WebSocketComponent = () => {
  const { assuranceCase, activeUsers, setActiveUsers } = useStore();
  const [token] = useLoginToken();
  const [messages, setMessages] = useState<string[]>([]);
  const [debug, setDebug] = useState<boolean>(false);

  const wsUrl = `wss://staging-eap-backend.azurewebsites.net/ws/case/${assuranceCase.id}/?token=${token}`
  const pingInterval = 1200;

  useEffect(() => {
    let websocket: any;
    let interval: any;

    const setupWebSocket = () => {
      websocket = new WebSocket(wsUrl);

      websocket.addEventListener("open", (event: any) => {
        console.log("WebSocket connection established: ", event);
        const pingMessage = JSON.stringify({ content: "ping" });

        // Send an initial ping message and start ping interval
        websocket.send(pingMessage);
        interval = setInterval(() => {
          websocket.send(pingMessage);
        }, pingInterval);
      });

      websocket.addEventListener("message", (event: any) => {
        console.log("Message received from server: ", event);
        setMessages((prevMessages) => [...prevMessages, `Received "${event.data}" from server.`]);

        const data = JSON.parse(event.data)
        const users = data.content.current_connections
        setActiveUsers(users)
      });

      websocket.addEventListener("close", (event: any) => {
        console.log("WebSocket connection closed: ", event);
        clearInterval(interval);  // Stop the ping interval when socket is closed
      });

      websocket.addEventListener("error", (event: any) => {
        console.error("WebSocket error occurred: ", event);
      });
    };

    // Initialize the WebSocket connection
    setupWebSocket();

    // Cleanup function to close WebSocket and clear interval on unmount
    return () => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
        setActiveUsers([])
      }
      clearInterval(interval);
    };
  }, []); // Empty dependency array ensures the effect runs only once on mount

  return (
    <div className={`${!debug ? 'hidden' : 'absolute'} w-full h-full z-50 top-0 left-0 bg-background p-4 rounded-md`}>
      <h1 className='mb-2'>WebSocket | Users</h1>
      <div className="output">
        <p>Active Users: {activeUsers.length}</p>
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </div>
      <Button 
        variant={'ghost'} 
        size={'sm'} 
        className='absolute top-2 right-2'
        onClick={() => setDebug(false)}><X className='w-4 h-4'/></Button>
    </div>
  );
};

export default WebSocketComponent;
