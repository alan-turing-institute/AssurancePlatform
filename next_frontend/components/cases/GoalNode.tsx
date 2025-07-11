'use client'

import { ArrowDown, ChevronDown, Goal } from 'lucide-react';
import React, { memo, useState } from 'react';
import { Handle, NodeProps, Position, getConnectedEdges, getOutgoers } from 'reactflow';
import ToggleButton from './ToggleButton';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import IconIndicator from './IconIndicator';

function GoalNode({ data, ...props }: NodeProps) {
  const [hidden, setHidden] = useState<boolean>(true)

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-pink-600 text-white w-[300px]">
      <div className="flex justify-start items-center">
        <div className="rounded-full w-12 h-12 flex justify-center items-center bg-slate-900/20">
          <Goal />
        </div>
        <div className="ml-2 w-[200px]">
          <div className='flex justify-start items-center gap-4'>
            <div className="text-lg font-bold">{data.name}</div>
            <IconIndicator data={data} />
          </div>
          {/* Ensure there is a value */}
          {data.description ? (
            <p className="text-xs line-clamp-2">{data.description}</p>
          ) : (
            <p className="text-xs line-clamp-2">No description available.</p>
          )}
        </div>
        <ToggleButton node={props} />
      </div>

      {/* <Handle type="source" id='b' position={Position.Right} />
      <Handle type="source" id='a' position={Position.Left} /> */}
      <Handle type="source" id='c' position={Position.Bottom} />
    </div>
  );
}

export default memo(GoalNode);
