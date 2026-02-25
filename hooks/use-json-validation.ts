"use client";

import type { Diagnostic } from "@codemirror/lint";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type CaseExportNested,
	CaseExportNestedSchema,
} from "@/lib/schemas/case-export";
import { validateTreeStructure } from "@/lib/services/json-diff-service";

/**
 * Regex patterns used for position detection - defined at top level for performance
 */
const ARRAY_INDEX_PATTERN = /^\d+$/;
const POSITION_PATTERN = /position (\d+)/;

/**
 * Validation error with position information
 */
export type ValidationError = {
	message: string;
	path: string;
	line?: number;
	column?: number;
};

/**
 * Result of JSON validation
 */
export type JsonValidationResult = {
	isValid: boolean;
	errors: ValidationError[];
	diagnostics: Diagnostic[];
	parsedData: CaseExportNested | null;
};

/**
 * Options for the validation hook
 */
type UseJsonValidationOptions = {
	/** Debounce delay in milliseconds (default: 300) */
	debounceMs?: number;
};

/**
 * Finds the line and column for a JSON path in the source text.
 * Uses a simple heuristic to locate keys in the JSON.
 */
function findPositionForPath(
	content: string,
	path: string
): { line: number; column: number; from: number; to: number } | null {
	// Split path into segments (e.g., "tree.children.0.name" -> ["tree", "children", "0", "name"])
	const segments = path.split(".");
	if (segments.length === 0) {
		return null;
	}

	// Try to find the last segment as a key
	const lastSegment = segments.at(-1);
	if (!lastSegment) {
		return null;
	}

	// If it's an array index, try to find the parent key
	const keyToFind = ARRAY_INDEX_PATTERN.test(lastSegment)
		? (segments.at(-2) ?? lastSegment)
		: lastSegment;

	// Search for the key in the JSON
	const keyPattern = new RegExp(`"${keyToFind}"\\s*:`);
	const match = content.match(keyPattern);

	if (!match?.index) {
		return null;
	}

	// Calculate line and column
	const beforeMatch = content.slice(0, match.index);
	const lines = beforeMatch.split("\n");
	const line = lines.length;
	const column = (lines.at(-1)?.length ?? 0) + 1;

	return {
		line,
		column,
		from: match.index,
		to: match.index + match[0].length,
	};
}

/**
 * Parses JSON with error position detection
 */
function parseJsonWithPosition(content: string): {
	success: boolean;
	data?: unknown;
	error?: ValidationError;
} {
	try {
		const data = JSON.parse(content) as unknown;
		return { success: true, data };
	} catch (error) {
		if (error instanceof SyntaxError) {
			// Try to extract position from error message
			const posMatch = error.message.match(POSITION_PATTERN);
			const pos = posMatch ? Number.parseInt(posMatch[1], 10) : 0;

			// Calculate line and column from position
			const beforeError = content.slice(0, pos);
			const lines = beforeError.split("\n");
			const line = lines.length;
			const column = (lines.at(-1)?.length ?? 0) + 1;

			return {
				success: false,
				error: {
					message: error.message,
					path: "",
					line,
					column,
				},
			};
		}
		return {
			success: false,
			error: {
				message: error instanceof Error ? error.message : "Invalid JSON",
				path: "",
			},
		};
	}
}

/**
 * Converts a validation error to a CodeMirror diagnostic
 */
function errorToDiagnostic(
	error: ValidationError,
	content: string
): Diagnostic {
	let from = 0;
	let to = Math.min(content.length, 100);

	if (error.line && error.column) {
		// Calculate position from line/column
		const lines = content.split("\n");
		let pos = 0;
		for (let i = 0; i < error.line - 1 && i < lines.length; i++) {
			pos += (lines[i]?.length ?? 0) + 1; // +1 for newline
		}
		from = pos + (error.column - 1);
		to = from + 10; // Highlight a small range
	} else if (error.path) {
		// Try to find position from path
		const position = findPositionForPath(content, error.path);
		if (position) {
			from = position.from;
			to = position.to;
		}
	}

	// Ensure bounds
	from = Math.max(0, Math.min(from, content.length - 1));
	to = Math.max(from + 1, Math.min(to, content.length));

	return {
		from,
		to,
		severity: "error",
		message: error.message,
	};
}

/**
 * Hook for validating JSON content against the case export schema.
 *
 * Features:
 * - Debounced validation (300ms default)
 * - JSON syntax validation
 * - Zod schema validation
 * - Tree structure validation (circular references, root element)
 * - CodeMirror diagnostic generation
 *
 * @param content - JSON content to validate
 * @param options - Validation options
 * @returns Validation result with errors and diagnostics
 */
export function useJsonValidation(
	content: string,
	options: UseJsonValidationOptions = {}
): JsonValidationResult {
	const { debounceMs = 300 } = options;

	const [result, setResult] = useState<JsonValidationResult>({
		isValid: false,
		errors: [],
		diagnostics: [],
		parsedData: null,
	});

	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const contentRef = useRef(content);

	// Keep contentRef updated
	useEffect(() => {
		contentRef.current = content;
	}, [content]);

	const validate = useCallback(() => {
		const currentContent = contentRef.current;
		const errors: ValidationError[] = [];

		// Skip validation for empty content
		if (!currentContent.trim()) {
			setResult({
				isValid: false,
				errors: [{ message: "JSON content is empty", path: "" }],
				diagnostics: [],
				parsedData: null,
			});
			return;
		}

		// Step 1: Parse JSON
		const parseResult = parseJsonWithPosition(currentContent);
		if (!parseResult.success) {
			const syntaxError = parseResult.error ?? {
				message: "Invalid JSON syntax",
				path: "",
			};
			setResult({
				isValid: false,
				errors: [syntaxError],
				diagnostics: [errorToDiagnostic(syntaxError, currentContent)],
				parsedData: null,
			});
			return;
		}

		// Step 2: Validate against Zod schema
		const schemaResult = CaseExportNestedSchema.safeParse(parseResult.data);
		if (!schemaResult.success) {
			for (const issue of schemaResult.error.issues) {
				errors.push({
					message: issue.message,
					path: issue.path.join("."),
				});
			}
			setResult({
				isValid: false,
				errors,
				diagnostics: errors.map((e) => errorToDiagnostic(e, currentContent)),
				parsedData: null,
			});
			return;
		}

		// Step 3: Validate tree structure
		const structureErrors = validateTreeStructure(schemaResult.data);
		if (structureErrors.length > 0) {
			for (const errorMessage of structureErrors) {
				errors.push({
					message: errorMessage,
					path: "tree",
				});
			}
			setResult({
				isValid: false,
				errors,
				diagnostics: errors.map((e) => errorToDiagnostic(e, currentContent)),
				parsedData: null,
			});
			return;
		}

		// All validations passed
		setResult({
			isValid: true,
			errors: [],
			diagnostics: [],
			parsedData: schemaResult.data,
		});
	}, []);

	// Debounced validation effect - triggers when content changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: content is intentionally in deps to trigger debounced validation
	useEffect(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			validate();
		}, debounceMs);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [content, debounceMs, validate]);

	// Memoize the result to prevent unnecessary re-renders
	return useMemo(() => result, [result]);
}

/**
 * Creates a lint source function for CodeMirror from validation diagnostics
 */
export function createLintSource(diagnostics: Diagnostic[]) {
	return () => diagnostics;
}
