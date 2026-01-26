"use client";

import { ExternalLink } from "lucide-react";
import { memo } from "react";
import type { NodeProps } from "reactflow";
import { BaseNode } from "@/components/shared/nodes";
import IconIndicator from "./icon-indicator";

function EvidenceNode({ data, ...props }: NodeProps) {
	const url = data.URL || data.url;

	return (
		<BaseNode
			description={data.description}
			name={data.name}
			nodeType="evidence"
			selected={props.selected}
			topRightActions={<IconIndicator data={data} />}
		>
			{url && (
				<div className="space-y-1">
					<span className="font-medium text-gray-500 text-xs uppercase tracking-wider">
						Source
					</span>
					<a
						className="flex items-center gap-1.5 text-blue-600 text-sm hover:text-blue-800 hover:underline"
						href={url}
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
						rel="noopener noreferrer"
						target="_blank"
					>
						<ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
						<span className="truncate">{url}</span>
					</a>
				</div>
			)}
		</BaseNode>
	);
}

export default memo(EvidenceNode);
