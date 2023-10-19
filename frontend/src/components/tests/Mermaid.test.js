/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import Mermaid from "../Mermaid.js";
import mermaid from "mermaid";
import "regenerator-runtime/runtime";
import "@testing-library/jest-dom";

jest.mock("mermaid", () => ({
  initialize: jest.fn(),
  contentLoaded: jest.fn(),
}));

test("renders chart markdown", () => {
  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  expect(screen.getByText("graph TB;  A[TestGoal];")).toBeInTheDocument();
});

test("mermaid is initialized with correct parameters", () => {
  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  expect(mermaid.initialize).toHaveBeenCalledWith({
    theme: "base",
    logLevel: 1,
    securityLevel: "loose",
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: "linear",
    },
    themeVariables: {
      primaryColor: "#ffffff",
      nodeBorder: "#000000",
      defaultLinkColor: "#004990",
      fontFamily: "arial",
    },
  });
});

test("window callback is set", () => {
  const mockFunc = jest.fn();
  render(
    <Mermaid chartmd="graph TB;  A[TestGoal];" viewLayerFunc={mockFunc} />,
  );
  expect(window.callback).toEqual(mockFunc);
});

test("mermaid contentLoaded is called", () => {
  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  expect(mermaid.contentLoaded).toHaveBeenCalled();
});

test("SVG max-height is set to 100%", () => {
  // Mock the behavior of Mermaid rendering
  document.getElementsByClassName = jest.fn().mockReturnValue([
    {
      childNodes: [
        {
          style: {},
        },
      ],
    },
  ]);

  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  const svgStyle =
    document.getElementsByClassName("mermaid")[0].childNodes[0].style;
  expect(svgStyle["max-height"]).toBe("100%");
});
