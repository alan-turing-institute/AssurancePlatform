/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import Mermaid from "../Mermaid.js";
import "regenerator-runtime/runtime";
import "@testing-library/jest-dom";

test("renders chart", async () => {
  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  // Use findBy with a regex and await the result
  const chartText = await screen.findByText(/A\[TestGoal\];/);
  expect(chartText).toBeInTheDocument();
});

// jest.mock("mermaid", () => ({
//   initialize: jest.fn(),
//   contentLoaded: jest.fn(),
// }));

// test("mermaid is initialized with correct parameters", () => {
//   render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
//   expect(mermaid.initialize).toHaveBeenCalledWith({
//     theme: "base",
//     logLevel: 1,
//     securityLevel: "loose",
//     flowchart: {
//       useMaxWidth: true,
//       htmlLabels: true,
//       curve: "linear",
//     },
//     themeVariables: {
//       primaryColor: "#ffffff",
//       nodeBorder: "#000000",
//       defaultLinkColor: "#004990",
//       fontFamily: "arial",
//     },
//   });
// });

// test("window callback is set", () => {
//   const mockFunc = jest.fn();
//   render(
//     <MermaidChart chartmd="graph TB;  A[TestGoal];" viewLayerFunc={mockFunc} />,
//   );
//   expect(window.callback).toEqual(mockFunc);
// });

// test("mermaid contentLoaded is called", () => {
//   render(<MermaidChart chartmd="graph TB;  A[TestGoal];" />);
//   expect(mermaid.contentLoaded).toHaveBeenCalled();
// });

// test("SVG max-height is set to 100%", () => {
//   const mockGetElementsByClassName = jest.spyOn(document, 'getElementsByClassName');
//   const mockStyle = {};  // This will store any styles set on the mock SVG
//   mockGetElementsByClassName.mockReturnValue([{
//     childNodes: [{ style: mockStyle }],
//   }]);

//   render(<MermaidChart chartmd="graph TB;  A[TestGoal];" />);

//   expect(mockStyle["max-height"]).toBe("100%");

//   mockGetElementsByClassName.mockRestore();
// });
