'use client';

import { Database } from 'lucide-react';
import { memo } from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';
import IconIndicator from './icon-indicator';

function EvidenceNode({ data }: NodeProps) {
  return (
    <div
      className={
        'w-[300px] rounded-md bg-emerald-600 px-4 py-2 text-white shadow-md'
      }
    >
      <div className="flex items-center justify-start">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-800/30">
          <Database />
        </div>
        <div className="ml-2 w-[200px]">
          <div className="flex items-center justify-start gap-4">
            <div className="font-bold text-lg">{data.name}</div>
            <IconIndicator data={data} />
          </div>
          <p className="line-clamp-2 text-xs">{data.description}</p>
        </div>
      </div>

      <Handle position={Position.Top} type="target" />
      {/* <Handle type="source" position={Position.Bottom} /> */}
    </div>
  );
}

export default memo(EvidenceNode);
