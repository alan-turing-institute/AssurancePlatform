'use client'

import { ChevronDown } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

function ContextNode({ isConnectable, data }: any) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-full bg-white border-2 border-slate-900 text-slate-900`}>
      <div className="flex">
        <div className={`rounded-full w-12 h-12 flex justify-center items-center bg-slate-900/20`}>
          {/* {data.emoji} */}
          {data.icon}
        </div>
        <div className="ml-2 w-[200px]">
          <div className="text-lg font-bold">{data.name}</div>
          <div className="text-xs truncate">{data.description}</div>
        </div>
      </div>

      <Handle type="target" position={Position.Right} />
      {/* <Handle type="source" position={Position.Left} isConnectable={false} /> */}
    </div>
  );
}

export default memo(ContextNode);
