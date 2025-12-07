"use client";

import { Trash2 } from "lucide-react";
import type React from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Textarea } from "../ui/textarea";

type FormValues = {
	assumption?: string;
	justification?: string;
	context?: string[];
};

type AttributeTextFieldProps = {
	form: UseFormReturn<FormValues>;
	name: "assumption" | "justification";
	label: string;
	placeholder: string;
	readOnly: boolean;
	onClear: () => void;
};

/**
 * Reusable text field for assumption and justification attributes.
 */
const AttributeTextField: React.FC<AttributeTextFieldProps> = ({
	form,
	name,
	label,
	placeholder,
	readOnly,
	onClear,
}) => (
	<FormField
		control={form.control}
		name={name}
		render={({ field }) => (
			<FormItem>
				<div className="flex items-center justify-between">
					<FormLabel>{label}</FormLabel>
					{!readOnly && (
						<button
							className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
							onClick={onClear}
							title={`Remove ${label.toLowerCase()}`}
							type="button"
						>
							<Trash2 className="h-4 w-4" />
						</button>
					)}
				</div>
				<FormControl>
					<Textarea
						placeholder={placeholder}
						rows={5}
						{...field}
						readOnly={readOnly}
					/>
				</FormControl>
				<FormMessage />
			</FormItem>
		)}
	/>
);

export default AttributeTextField;
