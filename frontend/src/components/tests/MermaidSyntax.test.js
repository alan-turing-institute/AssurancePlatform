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
  splitCommaSeparatedString,
  joinCommaSeparatedString,
  jsonToMermaid,
  sanitizeForMermaid,
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
  let output = jsonToMermaid(input, null, null);
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
    color_profile: "default",
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
  let output = jsonToMermaid(input, null, null);
  expect(output.includes("test goal"));
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
  const markdown = jsonToMermaid(input, "TopLevelNormativeGoal", "1");

  expect(markdown).toContain("class TopLevelNormativeGoal_1 classHighlighted;");
  expect(markdown).not.toContain("class TopLevelNormativeGoal_2 classHighlighted;");
});

test("splitCommaSeparatedString splits correctly", () => {
  const str = "a, b, c,";
  expect(splitCommaSeparatedString(str)).toEqual(["a", "b", "c"]);
});

test("joinCommaSeparatedString joins correctly", () => {
  const arr = ["a", "b", "c"];
  expect(joinCommaSeparatedString(arr)).toBe("a,b,c");
});
