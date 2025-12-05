"use client";

import { Goal } from "lucide-react";
import { memo, useState } from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import IconIndicator from "./icon-indicator";
import ToggleButton from "./toggle-button";

function GoalNode({ data, ...props }: NodeProps) {
	const [_hidden, _setHidden] = useState<boolean>(true);

	return (
		<div className="w-[300px] rounded-md bg-pink-600 px-4 py-2 text-white shadow-md">
			<div className="flex items-center justify-start">
				<div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/20">
					<Goal />
				</div>
				<div className="ml-2 w-[200px]">
					<div className="flex items-center justify-start gap-4">
						<div className="font-bold text-lg">{data.name}</div>
						<IconIndicator data={data} />
					</div>
					{/* Ensure there is a value */}
					{data.description ? (
						<p className="line-clamp-2 text-xs">{data.description}</p>
					) : (
						<p className="line-clamp-2 text-xs">No description available.</p>
					)}
				</div>
				<ToggleButton node={{ data, position: { x: 0, y: 0 }, ...props }} />
			</div>

			{/* <Handle type="source" id='b' position={Position.Right} />
      <Handle type="source" id='a' position={Position.Left} /> */}
			<Handle id="c" position={Position.Bottom} type="source" />
		</div>
	);
}

export default memo(GoalNode);
