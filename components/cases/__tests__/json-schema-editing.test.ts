/**
 * Exercises the schema-aware editing path itself — the same
 * codemirror-json-schema functions and the same schema file
 * (lib/schemas/json-schema-v1.0.json, imported by path) wired in
 * json-view-panel.tsx — against a real CodeMirror EditorState/EditorView.
 * No mocking of codemirror-json-schema: linter, completion and hover are
 * the library's actual implementations.
 */
import { CompletionContext } from "@codemirror/autocomplete";
import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	jsonCompletion,
	jsonSchemaHover,
	jsonSchemaLinter,
	stateExtensions,
} from "codemirror-json-schema";
import { describe, expect, it } from "vitest";
import rawCaseExportJsonSchema from "@/lib/schemas/json-schema-v1.0.json";

type CaseExportJsonSchema = NonNullable<Parameters<typeof stateExtensions>[0]>;
const caseExportJsonSchema =
	rawCaseExportJsonSchema as unknown as CaseExportJsonSchema;

const ROOT_ID = "11111111-1111-4111-8111-111111111111";

function buildDoc(
	options: { typeValue?: string; withBogusProperty?: boolean } = {}
): string {
	const { typeValue = "GOAL", withBogusProperty = false } = options;
	const envelope: Record<string, unknown> = {
		version: "1.0",
		exportedAt: "2026-09-14T10:00:00.000Z",
		case: { name: "Test Case", description: "A case" },
		tree: {
			id: ROOT_ID,
			type: typeValue,
			name: "G1",
			description: "Root goal",
			inSandbox: false,
			children: [],
		},
	};
	if (withBogusProperty) {
		envelope.bogusField = true;
	}
	return JSON.stringify(envelope, null, 2);
}

function buildView(doc: string): EditorView {
	const state = EditorState.create({
		doc,
		extensions: [json(), ...stateExtensions(caseExportJsonSchema)],
	});
	return new EditorView({ state });
}

describe("schema-aware editing — linter (jsonSchemaLinter)", () => {
	it("flags an invalid enum value on the offending line, naming the allowed values", () => {
		const doc = buildDoc({ typeValue: "GOALZ" });
		const view = buildView(doc);

		try {
			const diagnostics = jsonSchemaLinter()(view);

			expect(diagnostics.length).toBeGreaterThan(0);
			const diagnostic = diagnostics.at(0);
			expect(diagnostic).toBeDefined();
			if (!diagnostic) {
				return;
			}
			// The diagnostic is anchored on the "type" line itself (the
			// library's valueFrom/valueTo for enum errors sits just before the
			// value token, not the exact quoted span) — line-anchoring is what
			// "a diagnostic on the offending line" means, not an exact range.
			const line = view.state.doc.lineAt(diagnostic.from);
			expect(line.text).toContain("GOALZ");
			// The rewritten message lists the schema's ElementType enum.
			expect(diagnostic.message).toContain("GOAL");
			expect(diagnostic.message).toContain("STRATEGY");
			expect(diagnostic.message).toContain("CONTRACT");
		} finally {
			view.destroy();
		}
	});

	it("flags an unknown property at its own position", () => {
		const doc = buildDoc({ withBogusProperty: true });
		const view = buildView(doc);

		try {
			const diagnostics = jsonSchemaLinter()(view);

			expect(diagnostics.length).toBeGreaterThan(0);
			const bogusDiagnostic = diagnostics.find((diagnostic) =>
				doc.slice(diagnostic.from, diagnostic.to).includes("bogusField")
			);
			expect(bogusDiagnostic).toBeDefined();
		} finally {
			view.destroy();
		}
	});

	it("has no diagnostics for a schema-valid document", () => {
		const doc = buildDoc();
		const view = buildView(doc);

		try {
			expect(jsonSchemaLinter()(view)).toHaveLength(0);
		} finally {
			view.destroy();
		}
	});
});

describe("schema-aware editing — completion (jsonCompletion)", () => {
	it("suggests known property names inside an element object", () => {
		// An empty key being typed — the natural trigger position for
		// property-name completion, the same way an empty value (below)
		// triggers value completion.
		const doc = buildDocWithEmptyProperty();
		const view = buildView(doc);

		try {
			const pos = doc.indexOf('"": ""') + 1;
			const context = new CompletionContext(view.state, pos, true);

			const result = jsonCompletion()(context);

			expect(result).not.toEqual([]);
			if (Array.isArray(result)) {
				throw new Error("Expected a CompletionResult, not an empty array");
			}
			// Properties already present on this element ("id", "description",
			// etc.) are correctly excluded — completion only offers ones not
			// yet set, e.g. the optional "comments" and "context" fields.
			const labels = result.options.map((option) => option.label);
			expect(labels).toEqual(expect.arrayContaining(["comments", "context"]));
		} finally {
			view.destroy();
		}
	});

	it("suggests the ElementType enum values inside a type value", () => {
		// An empty type value: the cursor sits between the quotes.
		const doc = buildDocWithEmptyType();
		const view = buildView(doc);

		try {
			const pos = doc.indexOf('"type": "') + '"type": "'.length;
			const context = new CompletionContext(view.state, pos, true);

			const result = jsonCompletion()(context);

			expect(result).not.toEqual([]);
			if (Array.isArray(result)) {
				throw new Error("Expected a CompletionResult, not an empty array");
			}
			const labels = result.options.map((option) => option.label);
			expect(labels).toEqual(
				expect.arrayContaining(["GOAL", "STRATEGY", "EVIDENCE"])
			);
		} finally {
			view.destroy();
		}
	});
});

function buildDocWithEmptyType(): string {
	return JSON.stringify(
		{
			version: "1.0",
			exportedAt: "2026-09-14T10:00:00.000Z",
			case: { name: "Test Case", description: "A case" },
			tree: {
				id: ROOT_ID,
				type: "",
				name: "G1",
				description: "Root goal",
				inSandbox: false,
				children: [],
			},
		},
		null,
		2
	);
}

function buildDocWithEmptyProperty(): string {
	// An empty key/value pair inserted before "id" — JSON.stringify can't
	// produce an empty-string key from an object literal predictably next to
	// named ones, so this is built by direct string surgery on a known-good
	// document instead.
	const doc = buildDoc();
	return doc.replace('"id"', '"": "",\n    "id"');
}

describe("schema-aware editing — hover (jsonSchemaHover)", () => {
	it("shows the schema's description for a property with one", async () => {
		const doc = buildDoc();
		const view = buildView(doc);

		try {
			// Hover the "id" key — TreeNode.id has a description in the schema.
			const idKeyPos = doc.indexOf('"id"') + 2;
			const tooltip = await jsonSchemaHover()(view, idKeyPos, 1);

			expect(tooltip).not.toBeNull();
			const { dom } = tooltip?.create(view) ?? { dom: null };
			expect(dom?.textContent).toContain("Unique identifier for the element");
		} finally {
			view.destroy();
		}
	});
});
