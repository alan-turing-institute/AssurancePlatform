"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import type React from "react";
import { Button } from "../ui/button";

type AddAttributeButtonsProps = {
	hasAssumption: boolean;
	hasJustification: boolean;
	newAssumption: boolean;
	newJustification: boolean;
	supportsJustification: boolean;
	onToggleAssumption: () => void;
	onToggleJustification: () => void;
};

/**
 * Buttons for adding new assumption and justification attributes.
 */
const AddAttributeButtons: React.FC<AddAttributeButtonsProps> = ({
	hasAssumption,
	hasJustification,
	newAssumption,
	newJustification,
	supportsJustification,
	onToggleAssumption,
	onToggleJustification,
}) => (
	<div className="mt-4 flex flex-wrap items-center justify-start gap-2">
		{!hasAssumption && (
			<Button onClick={onToggleAssumption} size={"sm"} variant={"outline"}>
				{newAssumption ? (
					<MinusIcon className="mr-2 size-3" />
				) : (
					<PlusIcon className="mr-2 size-3" />
				)}
				Assumption
			</Button>
		)}
		{!hasJustification && supportsJustification && (
			<Button onClick={onToggleJustification} size={"sm"} variant={"outline"}>
				{newJustification ? (
					<MinusIcon className="mr-2 size-3" />
				) : (
					<PlusIcon className="mr-2 size-3" />
				)}
				Justification
			</Button>
		)}
	</div>
);

export default AddAttributeButtons;
