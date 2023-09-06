/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import "@testing-library/jest-dom";
import { jsonToMermaid, sanitizeForMermaid } from "../utils.js";

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
        strategy: [],
        property_claims: [],
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
        strategy: [],
        property_claims: [],
      },
    ],
  };
  let output = jsonToMermaid(input);
  expect(output.includes("test goal"));
});
