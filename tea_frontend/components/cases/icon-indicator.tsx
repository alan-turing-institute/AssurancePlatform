"use client";

import {
	ChatBubbleBottomCenterTextIcon,
	InformationCircleIcon,
} from "@heroicons/react/20/solid";
import { useCallback, useEffect, useState } from "react";
import type { Context } from "@/types";

type NodeData = {
	id: number | string;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	assumption?: string;
	justification?: string;
	context?: Context[];
	parentId?: string;
};

type IconIndicatorProps = {
	data: NodeData;
};

const IconIndicator = ({ data }: IconIndicatorProps) => {
	const [comments, setComments] = useState([]);

	const { assumption, justification, type } = data;

	const hasAssumptionOrJustificationOrContext =
		(typeof assumption === "string" && assumption.trim() !== "") ||
		(typeof justification === "string" && justification.trim() !== "") ||
		(Array.isArray(data.context) && data.context.length > 0);

	const fetchNodeComments = useCallback(async () => {
		try {
			// Use Next.js API route which handles both Prisma and Django auth
			const response = await fetch(`/api/elements/${data.id}/comments`);

			if (!response.ok) {
				// Silently fail - element may not exist or user may not have access
				return [];
			}

			const result = await response.json();
			return result;
		} catch (_error) {
			// Silently fail - element may not exist or user may not have access
			return [];
		}
	}, [data.id]);

	useEffect(() => {
		fetchNodeComments().then((result) => {
			setComments(result ?? []);
		});
	}, [fetchNodeComments]);

	return (
		<div
			className={`inline-flex ${type === "Strategy" ? "top-0 right-0" : "top-[6px] right-4"}`}
		>
			<div className="flex items-center justify-start gap-1">
				{hasAssumptionOrJustificationOrContext && (
					<InformationCircleIcon className="size-3 text-white/90" />
				)}
				{comments.length > 0 && (
					<ChatBubbleBottomCenterTextIcon className="size-3 text-white/90" />
				)}
			</div>
		</div>
	);
};

export default IconIndicator;
