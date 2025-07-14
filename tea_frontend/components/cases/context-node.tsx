'use client';

import { BookOpenText } from 'lucide-react';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';

function ContextNode({ isConnectable, data }: any) {
  return (
    <div
      className={
        'w-[300px] rounded-full border-2 border-slate-900 bg-white px-4 py-2 text-slate-900 shadow-md'
      }
    >
      <div className="flex items-center justify-start">
        <div
          className={
            'flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/20'
          }
        >
          <BookOpenText />
        </div>
        <div className="ml-2 w-[200px]">
          <div className="font-bold text-lg">{data.name}</div>
          <p className="line-clamp-2 text-xs">{data.description}</p>
        </div>
      </div>

      <Handle position={Position.Top} type="target" />
      {/* <Handle type="source" position={Position.Left} isConnectable={false} /> */}
    </div>
  );
}

export default memo(ContextNode);
