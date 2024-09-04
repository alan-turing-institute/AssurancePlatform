'use client';

import { useEffect, useState } from 'react';

const WebSocketComponent = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any>([]);

  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:80/1`);

    socket.onopen = () => {
      console.log('Connected to WebSocket');

      // Example user data
      const userData = {
        user_id: crypto.randomUUID(),
        user_name: 'Rich Griffiths'
      };

      // Send user data when connected
      socket.send(JSON.stringify(userData));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data)

      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.log('Message from server:', event.data);
        setMessages((prevMessages: any) => [...prevMessages, event.data]);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className='ml-8'>
      <div className='relative flex justify-start items-center'>
        {users.map((user: any, index: number) => {
          if (!user.name) {
            user.name = 'Guest';
          }

          return (
            <div
              key={user.userId}
              className={`dark:bg-indigo-600 bg-white text-foreground border-4 border-indigo-600 dark:border-slate-900 w-10 h-10 rounded-full uppercase font-semibold text-sm flex justify-center items-center ${index > 0 ? '-ml-2' : ''}`}
            >
              <>
                <span title={user.name}>{user.name.split(' ')[0].substring(0, 1)}</span>
                <span className='sr-only'>{user.name}</span>
              </>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WebSocketComponent;
