'use client'

import { ChevronDown, FolderOpenDot } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, NodeProps, NodeTypes, Position } from 'reactflow';
import ToggleButton from './ToggleButton';
import IconIndicator from './IconIndicator';

function PropertyNode({ data, ...props}: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-blue-600 text-white w-[300px]`}>
      <div className="flex justify-start items-center">
        <div className={`rounded-full w-12 h-12 flex justify-center items-center bg-slate-900/20`}>
          <FolderOpenDot />
        </div>
        <div className="ml-2 w-[200px]">
          <div className='flex justify-start items-center gap-4'>
            <div className="text-lg font-bold">{data.name}</div>
            <IconIndicator data={data} />
          </div>
          <p className="text-xs line-clamp-2">{data.description}</p>
        </div>
        <ToggleButton node={props}/>
      </div>

      <Handle type="target" position={Position.Top} />
      {/* <Handle type="source" id='a' position={Position.Left} /> */}
      <Handle type="source" id='c' position={Position.Bottom} />
    </div>
  );
}

export default memo(PropertyNode);
