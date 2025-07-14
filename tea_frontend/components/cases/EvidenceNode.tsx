'use client';

import { ChevronDown, Database } from 'lucide-react';
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import IconIndicator from './IconIndicator';

function EvidenceNode({ data }: any) {
  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md bg-emerald-600 text-white w-[300px]`}
    >
      <div className="flex justify-start items-center">
        <div className="rounded-full w-12 h-12 flex justify-center items-center bg-emerald-800/30">
          <Database />
        </div>
        <div className="ml-2 w-[200px]">
          <div className="flex justify-start items-center gap-4">
            <div className="text-lg font-bold">{data.name}</div>
            <IconIndicator data={data} />
          </div>
          <p className="text-xs line-clamp-2">{data.description}</p>
        </div>
      </div>

      <Handle type="target" position={Position.Top} />
      {/* <Handle type="source" position={Position.Bottom} /> */}
    </div>
  );
}

export default memo(EvidenceNode);
