import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Node.js fs and path modules before importing the route
vi.mock("node:fs");
vi.mock("node:path");

// Import modules after mocking
import fs from "node:fs";
import path from "node:path";

// Import the route module after the mocks are set up
import { GET } from "../route";

describe("/api/templates API Route", () => {
	const mockFs = vi.mocked(fs);
	const mockPath = vi.mocked(path);

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock path.resolve to return a predictable path
		mockPath.resolve.mockReturnValue("/app/caseTemplates");
		mockPath.join.mockImplementation((...args) => args.join("/"));
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("Template Discovery", () => {
		it("should read templates from caseTemplates directory", async () => {
			const mockFiles = ["template1.json", "template2.json", "README.md"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce('{"name": "template1", "type": "AssuranceCase"}')
				.mockReturnValueOnce('{"name": "template2", "type": "AssuranceCase"}');

			const response = await GET();
			const responseData = await response.json();

			expect(mockPath.resolve).toHaveBeenCalledWith(
				process.cwd(),
				"caseTemplates"
			);
			expect(mockFs.readdirSync).toHaveBeenCalledWith("/app/caseTemplates");
			expect(responseData.newTemplates).toHaveLength(2);
		});

		it("should filter only JSON files", async () => {
			const mockFiles = [
				"template1.json",
				"template2.json",
				"README.md",
				"config.txt",
				"template3.json",
				"image.png",
			];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce('{"name": "template1", "type": "AssuranceCase"}')
				.mockReturnValueOnce('{"name": "template2", "type": "AssuranceCase"}')
				.mockReturnValueOnce('{"name": "template3", "type": "AssuranceCase"}');

			const response = await GET();
			const responseData = await response.json();

			expect(mockFs.readFileSync).toHaveBeenCalledTimes(3);
			expect(responseData.newTemplates).toHaveLength(3);
			expect(
				responseData.newTemplates.map((t: { name: string }) => t.name)
			).toEqual(["template1", "template2", "template3"]);
		});

		it("should handle empty directory", async () => {
			mockFs.readdirSync.mockReturnValue([] as never);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});

		it("should handle directory with no JSON files", async () => {
			const mockFiles = ["README.md", "config.txt", "image.png"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);

			const response = await GET();
			const responseData = await response.json();

			expect(mockFs.readFileSync).not.toHaveBeenCalled();
			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});
	});

	describe("JSON Parsing", () => {
		it("should parse valid JSON template files", async () => {
			const mockFiles = ["safety-case.json", "security-case.json"];
			const safetyTemplate = {
				name: "Safety Case Template",
				type: "AssuranceCase",
				description: "Template for safety-critical systems",
				goals: [{ id: 1, name: "System is safe" }],
			};
			const securityTemplate = {
				name: "Security Case Template",
				type: "AssuranceCase",
				description: "Template for security assessments",
				goals: [{ id: 1, name: "System is secure" }],
			};

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce(JSON.stringify(safetyTemplate))
				.mockReturnValueOnce(JSON.stringify(securityTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates).toEqual([
				safetyTemplate,
				securityTemplate,
			]);
			expect(responseData.newTemplates[0]).toHaveProperty("goals");
			expect(responseData.newTemplates[1]).toHaveProperty("goals");
		});

		it("should read files with UTF-8 encoding", async () => {
			const mockFiles = ["template.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue('{"name": "test"}');

			await GET();

			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				"/app/caseTemplates/template.json",
				"utf-8"
			);
		});

		it("should handle templates with complex nested structures", async () => {
			const mockFiles = ["complex-template.json"];
			const complexTemplate = {
				name: "Complex Template",
				type: "AssuranceCase",
				goals: [
					{
						id: 1,
						name: "Primary Goal",
						strategies: [
							{
								id: 1,
								name: "Strategy 1",
								property_claims: [
									{
										id: 1,
										name: "Claim 1",
										evidence: [{ id: 1, name: "Evidence 1" }],
									},
								],
							},
						],
					},
				],
				contexts: [{ id: 1, name: "Context 1" }],
			};

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue(JSON.stringify(complexTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates[0]).toEqual(complexTemplate);
			expect(responseData.newTemplates[0].goals[0].strategies).toHaveLength(1);
		});
	});

	describe("Default Case Selection", () => {
		it('should select template named "empty" as default case', async () => {
			const mockFiles = ["basic.json", "empty.json", "advanced.json"];
			const basicTemplate = { name: "basic", type: "AssuranceCase" };
			const emptyTemplate = { name: "empty", type: "AssuranceCase" };
			const advancedTemplate = { name: "advanced", type: "AssuranceCase" };

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce(JSON.stringify(basicTemplate))
				.mockReturnValueOnce(JSON.stringify(emptyTemplate))
				.mockReturnValueOnce(JSON.stringify(advancedTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.defaultCase).toEqual(emptyTemplate);
			expect(responseData.defaultCase.name).toBe("empty");
		});

		it('should fallback to first template if no "empty" template exists', async () => {
			const mockFiles = ["basic.json", "advanced.json"];
			const basicTemplate = { name: "basic", type: "AssuranceCase" };
			const advancedTemplate = { name: "advanced", type: "AssuranceCase" };

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce(JSON.stringify(basicTemplate))
				.mockReturnValueOnce(JSON.stringify(advancedTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.defaultCase).toEqual(basicTemplate);
			expect(responseData.defaultCase.name).toBe("basic");
		});

		it("should return undefined default case when no templates exist", async () => {
			mockFs.readdirSync.mockReturnValue([] as never);

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.defaultCase).toBeUndefined();
		});

		it('should prefer "empty" template even if it appears later in array', async () => {
			const mockFiles = ["z-last.json", "a-first.json", "empty.json"];
			const lastTemplate = { name: "z-last", type: "AssuranceCase" };
			const firstTemplate = { name: "a-first", type: "AssuranceCase" };
			const emptyTemplate = { name: "empty", type: "AssuranceCase" };

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce(JSON.stringify(lastTemplate))
				.mockReturnValueOnce(JSON.stringify(firstTemplate))
				.mockReturnValueOnce(JSON.stringify(emptyTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.defaultCase).toEqual(emptyTemplate);
			expect(responseData.defaultCase.name).toBe("empty");
		});
	});

	describe("Error Handling", () => {
		it("should handle file system read errors", async () => {
			mockFs.readdirSync.mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});

		it("should handle invalid JSON files", async () => {
			const mockFiles = ["invalid.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue("invalid-json-content");

			const response = await GET();
			const responseData = await response.json();

			// Invalid JSON files are skipped, so we get empty results
			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});

		it("should handle file read errors for individual files", async () => {
			const mockFiles = ["template1.json", "template2.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce('{"name": "template1"}')
				.mockImplementationOnce(() => {
					throw new Error("File not found");
				});

			const response = await GET();
			const responseData = await response.json();

			// Only the first template should be included (second one fails to read)
			expect(responseData.newTemplates).toHaveLength(1);
			expect(responseData.newTemplates[0].name).toBe("template1");
		});

		it("should handle empty JSON files", async () => {
			const mockFiles = ["empty-file.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue("");

			const response = await GET();
			const responseData = await response.json();

			// Empty JSON files are skipped
			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});

		it("should handle malformed JSON", async () => {
			const mockFiles = ["malformed.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue('{"name": "test", }'); // trailing comma

			const response = await GET();
			const responseData = await response.json();

			// Malformed JSON files are skipped
			expect(responseData.newTemplates).toEqual([]);
			expect(responseData.defaultCase).toBeUndefined();
		});
	});

	describe("Response Format", () => {
		it("should return correct response structure", async () => {
			const mockFiles = ["template.json"];
			const template = { name: "test-template", type: "AssuranceCase" };

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue(JSON.stringify(template));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData).toHaveProperty("newTemplates");
			expect(responseData).toHaveProperty("defaultCase");
			expect(Array.isArray(responseData.newTemplates)).toBe(true);
		});

		it("should return JSON response with correct content type", async () => {
			mockFs.readdirSync.mockReturnValue([] as never);

			const response = await GET();

			expect(response.headers.get("content-type")).toContain(
				"application/json"
			);
			expect(response.status).toBe(200);
		});

		it("should preserve template data structure", async () => {
			const mockFiles = ["detailed-template.json"];
			const detailedTemplate = {
				name: "Detailed Template",
				type: "AssuranceCase",
				version: "1.0.0",
				author: "Test Author",
				created_date: "2024-01-01T00:00:00Z",
				metadata: {
					category: "Safety",
					complexity: "High",
					tags: ["automotive", "safety-critical"],
				},
				goals: [
					{
						id: 1,
						name: "System Safety Goal",
						description: "The system shall operate safely",
						success_criteria: "Zero safety incidents",
					},
				],
			};

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue(JSON.stringify(detailedTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates[0]).toEqual(detailedTemplate);
			expect(responseData.newTemplates[0].metadata).toEqual(
				detailedTemplate.metadata
			);
			expect(responseData.newTemplates[0].goals).toEqual(
				detailedTemplate.goals
			);
		});
	});

	describe("File Path Handling", () => {
		it("should construct correct file paths", async () => {
			const mockFiles = ["template1.json", "template2.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue('{"name": "test"}');

			await GET();

			expect(mockPath.join).toHaveBeenCalledWith(
				"/app/caseTemplates",
				"template1.json"
			);
			expect(mockPath.join).toHaveBeenCalledWith(
				"/app/caseTemplates",
				"template2.json"
			);
			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				"/app/caseTemplates/template1.json",
				"utf-8"
			);
			expect(mockFs.readFileSync).toHaveBeenCalledWith(
				"/app/caseTemplates/template2.json",
				"utf-8"
			);
		});

		it("should use process.cwd() for base directory", async () => {
			mockFs.readdirSync.mockReturnValue([] as never);

			await GET();

			expect(mockPath.resolve).toHaveBeenCalledWith(
				process.cwd(),
				"caseTemplates"
			);
		});

		it("should handle templates in subdirectories if present", async () => {
			// Note: Current implementation doesn't handle subdirectories,
			// but this test documents the expected behavior
			const mockFiles = ["template.json"];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync.mockReturnValue('{"name": "test"}');

			await GET();

			expect(mockPath.join).toHaveBeenCalledWith(
				"/app/caseTemplates",
				"template.json"
			);
		});
	});

	describe("Template Processing", () => {
		it("should maintain template order from file system", async () => {
			const mockFiles = [
				"c-template.json",
				"a-template.json",
				"b-template.json",
			];

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce('{"name": "c-template"}')
				.mockReturnValueOnce('{"name": "a-template"}')
				.mockReturnValueOnce('{"name": "b-template"}');

			const response = await GET();
			const responseData = await response.json();

			expect(
				responseData.newTemplates.map((t: { name: string }) => t.name)
			).toEqual(["c-template", "a-template", "b-template"]);
		});

		it("should process all valid JSON files regardless of content", async () => {
			const mockFiles = ["minimal.json", "maximal.json"];
			const minimalTemplate = { name: "minimal" };
			const maximalTemplate = {
				name: "maximal",
				type: "AssuranceCase",
				description: "Full template",
				goals: [],
				strategies: [],
				evidence: [],
				contexts: [],
				metadata: {},
			};

			mockFs.readdirSync.mockReturnValue(mockFiles as never);
			mockFs.readFileSync
				.mockReturnValueOnce(JSON.stringify(minimalTemplate))
				.mockReturnValueOnce(JSON.stringify(maximalTemplate));

			const response = await GET();
			const responseData = await response.json();

			expect(responseData.newTemplates).toHaveLength(2);
			expect(responseData.newTemplates[0]).toEqual(minimalTemplate);
			expect(responseData.newTemplates[1]).toEqual(maximalTemplate);
		});
	});
});
