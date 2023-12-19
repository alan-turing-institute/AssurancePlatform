/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import "@testing-library/jest-dom";
import {
  removeArrayElement,
  splitCommaSeparatedString,
  joinCommaSeparatedString,
  jsonToMermaid,
  sanitizeForHtml,
} from "../utils.js";

test("Simple JSON translation", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
    color_profile: "default",
    goals: [
      {
        id: 1,
        name: "test goal",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [],
        strategies: [],
      },
    ],
  };
  let output = jsonToMermaid(input, null, null, []);
  expect(output).toContain("test goal");
});

test("Sanitize replaces html characters", () => {
  let input = "test string<>'\"&";
  let output = sanitizeForHtml(input);
  expect(output).toBe("test string&lt;&gt;&apos;&quot;&amp;");
});

test("jsonToMermaid sanitizes goal name", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
    color_profile: "default",
    goals: [
      {
        id: 1,
        name: "test goal<>'\"&}",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [],
        strategies: [],
      },
    ],
  };
  let output = jsonToMermaid(input, null, null, []);
  expect(output).toContain("test goal&lt;&gt;&apos;&quot;&amp;");
});

test("removeArrayElement removes correct element", () => {
  const arr = [1, 2, 3, 4];
  removeArrayElement(arr, 3);
  expect(arr).toEqual([1, 2, 4]);
});

test("jsonToMermaid highlights correct class", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
    color_profile: "default",
    goals: [
      {
        id: 1,
        name: "test goal",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [],
        strategies: [],
      },
      {
        id: 2,
        name: "test goal",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [],
        strategies: [],
      },
    ],
  };
  const markdown = jsonToMermaid(input, "TopLevelNormativeGoal", "1", []);

  expect(markdown).toContain("class TopLevelNormativeGoal_1 classHighlighted;");
  expect(markdown).not.toContain(
    "class TopLevelNormativeGoal_2 classHighlighted;",
  );
});

test("splitCommaSeparatedString splits correctly", () => {
  const str = "a, b, c,";
  expect(splitCommaSeparatedString(str)).toEqual(["a", "b", "c"]);
});

test("joinCommaSeparatedString joins correctly", () => {
  const arr = ["a", "b", "c"];
  expect(joinCommaSeparatedString(arr)).toBe("a,b,c");
});

test("jsonToMermaid collapses nodes correctly", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
    color_profile: "default",
    goals: [
      {
        id: 1,
        name: "test goal",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [
          {
            id: 1,
            type: "PropertyClaim",
            name: "Test claim 1",
            short_description: "short",
            long_description: "long",
            goal_id: 1,
            property_claim_id: null,
            level: 1,
            claim_type: "Project claim",
            property_claims: [],
            evidence: [
              {
                id: 1,
                type: "Evidence",
                name: "Test evidence 1.1",
                short_description: "short",
                long_description: "long",
                URL: "www.some-evidence.com",
                property_claim_id: [1],
              },
            ],
            strategy_id: null,
          },
          {
            id: 2,
            type: "PropertyClaim",
            name: "Test claim 2",
            short_description: "short",
            long_description: "long",
            goal_id: 1,
            property_claim_id: null,
            level: 1,
            claim_type: "Project claim",
            property_claims: [],
            evidence: [
              {
                id: 2,
                type: "Evidence",
                name: "Test evidence 2.1",
                short_description: "short",
                long_description: "long",
                URL: "www.some-evidence.com",
                property_claim_id: [2],
              },
            ],
            strategy_id: null,
          },
        ],
        strategies: [],
      },
    ],
  };
  const markdown = jsonToMermaid(input, "Goal", "1", ["PropertyClaim_2"]);

  expect(markdown).toContain("Test claim 1");
  expect(markdown).toContain("Test evidence 1.1");
  // collapsed node still present
  expect(markdown).toContain("Test claim 2");
  // child of collapsed node not visible
  expect(markdown).not.toContain("Test evidence 2.1");
});
