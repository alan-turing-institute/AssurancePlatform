import type { Node } from "reactflow";

export type NodeData = {
	id: number;
	name: string;
	type: string;
	goal_id?: number | null;
	strategy_id?: number | null;
	property_claim_id?: number | number[] | null;
	short_description?: string;
	[key: string]: unknown;
};

export interface AssuranceCaseNode extends Node {
	data: NodeData;
	type: string;
}

export type MoveElement = {
	id: number;
	name: string;
};

export type UpdateItem = {
	goal_id?: number | null;
	strategy_id?: number | null;
	property_claim_id?: number | number[] | null;
	hidden?: boolean;
};
