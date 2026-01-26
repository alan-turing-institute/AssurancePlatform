"use client";

import { memo } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode } from "@/components/shared/nodes";
import IconIndicator from "./icon-indicator";
import ToggleButton from "./toggle-button";

function StrategyNode({ data, ...props }: NodeProps) {
	return (
		<BaseNode
			assumption={data.assumption}
			bottomLeftActions={
				<ToggleButton node={{ data, position: { x: 0, y: 0 }, ...props }} />
			}
			context={data.context}
			description={data.description}
			justification={data.justification}
			name={data.name}
			nodeType="strategy"
			selected={props.selected}
			topRightActions={<IconIndicator data={data} />}
		/>
	);
}

export default memo(StrategyNode);
