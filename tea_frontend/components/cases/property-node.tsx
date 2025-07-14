'use client';

import { FolderOpenDot } from 'lucide-react';
import { memo } from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';
import IconIndicator from './icon-indicator';
import ToggleButton from './toggle-button';

function PropertyNode({ data, ...props }: NodeProps) {
  return (
    <div
      className={
        'w-[300px] rounded-md bg-blue-600 px-4 py-2 text-white shadow-md'
      }
    >
      <div className="flex items-center justify-start">
        <div
          className={
            'flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/20'
          }
        >
          <FolderOpenDot />
        </div>
        <div className="ml-2 w-[200px]">
          <div className="flex items-center justify-start gap-4">
            <div className="font-bold text-lg">{data.name}</div>
            <IconIndicator data={data} />
          </div>
          <p className="line-clamp-2 text-xs">{data.description}</p>
        </div>
        <ToggleButton node={props} />
      </div>

      <Handle position={Position.Top} type="target" />
      {/* <Handle type="source" id='a' position={Position.Left} /> */}
      <Handle id="c" position={Position.Bottom} type="source" />
    </div>
  );
}

export default memo(PropertyNode);
