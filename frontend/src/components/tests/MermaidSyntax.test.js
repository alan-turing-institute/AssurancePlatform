/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import "@testing-library/jest-dom";
import {
  getBaseURL,
  removeArrayElement,
  highlightNode,
  removeHighlight,
  splitCommaSeparatedString,
  joinCommaSeparatedString,
} from "../utils.js";

test("Simple JSON translation", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
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
  let output = jsonToMermaid(input);
  expect(output.includes("test goal"));
});

test("Sanitize removes brackets, semicolon", () => {
  let input = "test (st;rin[g";
  let output = sanitizeForMermaid(input);
  expect(output == "test string");
});

test("jsonToMermaid sanitizes goal name", () => {
  let input = {
    id: 1,
    name: "Test case",
    description: "",
    goals: [
      {
        id: 1,
        name: "test ()goal;}",
        short_description: "short",
        long_description: "long",
        context: [],
        property_claims: [],
        strategies: [],
      },
    ],
  };
  let output = jsonToMermaid(input);
  expect(output.includes("test goal"));
});

test("removeArrayElement removes correct element", () => {
  const arr = [1, 2, 3, 4];
  removeArrayElement(arr, 3);
  expect(arr).toEqual([1, 2, 4]);
});

test("highlightNode appends highlight class", () => {
  const markdown = "test markdown";
  const highlighted = highlightNode(markdown, "Goal", 1);
  expect(highlighted.endsWith("class Goal_1 classHighlighted;\n")).toBe(true);
});

test("removeHighlight removes the highlight class", () => {
  const highlighted = "test markdown\nclass Goal_1 classHighlighted;\n";
  const result = removeHighlight(highlighted);
  expect(result).toBe("test markdown");
});

test("splitCommaSeparatedString splits correctly", () => {
  const str = "a, b, c,";
  expect(splitCommaSeparatedString(str)).toEqual(["a", "b", "c"]);
});

test("joinCommaSeparatedString joins correctly", () => {
  const arr = ["a", "b", "c"];
  expect(joinCommaSeparatedString(arr)).toBe("a,b,c");
});
