// 'use client';

// import useStore from '@/data/store';
// import { useLoginToken } from '@/hooks/useAuth';
// import { useEffect, useRef } from 'react';

// const WebSocketComponent = () => {
//   const { assuranceCase } = useStore();
//   const [token] = useLoginToken();
//   const pingInterval = useRef(null);  // Ref to store the interval ID

//   useEffect(() => {
//     if (!assuranceCase?.id || !token) return;

//     const socket = new WebSocket(`wss://staging-eap-backend.azurewebsites.net/ws/case/${assuranceCase.id}/?token=${token}`);

//     socket.onopen = (event) => {
//       console.log('WebSocket connection established: ', event);
//       const pingMessage = JSON.stringify({ content: "ping" });

//       // Send a ping immediately after connection
//       socket.send(pingMessage);
      
//       // Set up a ping every 12 seconds
//       pingInterval.current = setInterval(() => {
//         if (socket.readyState === WebSocket.OPEN) {
//           socket.send(pingMessage);
//         }
//       }, 12000);
//     };

//     socket.onmessage = (event) => {
//       console.log('Message received:', JSON.parse(event.data));
//     };

//     socket.onclose = (event) => {
//       console.log('WebSocket disconnected', event.code, event.reason);
//     };

//     socket.onerror = (error) => {
//       console.error('WebSocket Error:', error);
//     };

//     // Cleanup function
//     return () => {
//       if (pingInterval.current) {
//         clearInterval(pingInterval.current);  // Clear the ping interval
//       }
//       if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
//         socket.close(1000, 'Client closed the connection');  // Gracefully close WebSocket
//       }
//     };
//   }, [assuranceCase?.id, token]);

//   return null;
// };

// export default WebSocketComponent;


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
      }
      clearInterval(interval);
    };
  }, []); // Empty dependency array ensures the effect runs only once on mount

  return (
    <div className={`${!debug ? 'hidden' : 'absolute'} w-full h-full z-50 top-0 left-0 bg-background p-4 rounded-md`}>
      <h1 className='mb-2'>WebSocket | Users</h1>
      <div className="output">
        {/* {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))} */}
        <p>Active Users: {activeUsers.length}</p>
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
