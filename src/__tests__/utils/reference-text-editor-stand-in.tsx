import { forwardRef, useImperativeHandle, useRef } from "react";
import type {
	ReferenceTextEditorHandle,
	ReferenceTextEditorProps,
} from "@/components/cases/reference-text-editor";

/**
 * A plain text box in place of the description editor, for tests of the edit
 * dialog's form wiring. The real editor is a contenteditable region that jsdom
 * cannot type into or click, so its behaviour is checked in a browser and its
 * text conversion in its own tests.
 */
const ReferenceTextEditorStandIn = forwardRef<
	ReferenceTextEditorHandle,
	ReferenceTextEditorProps
>(function ReferenceTextEditorStandIn(
	{
		"aria-describedby": describedBy,
		"aria-invalid": invalid,
		"aria-labelledby": labelledBy,
		id,
		onBlur,
		onChange,
		placeholder,
		readOnly,
		value,
	},
	ref
) {
	const textarea = useRef<HTMLTextAreaElement>(null);
	useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }));
	return (
		<textarea
			aria-describedby={describedBy}
			aria-invalid={invalid}
			aria-labelledby={labelledBy}
			id={id}
			onBlur={onBlur}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			readOnly={readOnly}
			ref={textarea}
			value={value}
		/>
	);
});

// fallow-ignore-next-line unused-export
export default ReferenceTextEditorStandIn;
