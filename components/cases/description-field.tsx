"use client";

import { Lock } from "lucide-react";
import dynamic from "next/dynamic";
import { useId, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import type { NodeEditFormInput } from "@/lib/schemas/element";
import type { ReferenceTextEditorHandle } from "./reference-text-editor";

// The editor and the rich-text library behind it load when a dialog that
// needs them opens, not with the case page: every card on the diagram
// imports the dialog.
const ReferenceTextEditor = dynamic(() => import("./reference-text-editor"), {
	ssr: false,
	loading: () => (
		<div
			aria-busy="true"
			className="min-h-[80px] w-full rounded-md border border-input bg-background"
		/>
	),
});

interface DescriptionFieldProps {
	/** Puts the caret in the description as soon as the editor is there. */
	autoFocus: boolean;
	form: UseFormReturn<NodeEditFormInput>;
	placeholder: string;
	readOnly: boolean;
	/** What a reference typed in the description can point at. */
	terms: readonly DefinedTerm[];
}

/**
 * The description of a goal, strategy or property claim: a text field in which
 * typing `{` offers the terms in reach. As a form field it is labelled by its
 * label, carries the form's error state, and takes focus from the form's
 * first-error logic.
 */
export default function DescriptionField({
	autoFocus,
	form,
	placeholder,
	readOnly,
	terms,
}: DescriptionFieldProps) {
	const labelId = useId();
	const editorRef = useRef<ReferenceTextEditorHandle | null>(null);
	return (
		<FormField
			control={form.control}
			name="description"
			render={({ field }) => (
				<FormItem>
					<FormLabel
						className="flex items-center gap-2"
						id={labelId}
						// A label cannot name an editable region by itself, so a click on it
						// moves the caret there as it would for a text box.
						onClick={() => editorRef.current?.focus()}
					>
						Description
						{readOnly && (
							<span className="text-muted-foreground" title="Read Only">
								<Lock className="h-3 w-3" />
							</span>
						)}
					</FormLabel>
					<FormControl>
						<ReferenceTextEditor
							aria-labelledby={labelId}
							autoFocus={autoFocus}
							onBlur={field.onBlur}
							onChange={field.onChange}
							placeholder={placeholder}
							readOnly={readOnly}
							ref={(handle: ReferenceTextEditorHandle | null) => {
								editorRef.current = handle;
								field.ref(handle);
							}}
							terms={terms}
							value={field.value ?? ""}
						/>
					</FormControl>
					<FormMessage />
				</FormItem>
			)}
		/>
	);
}
