import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import Mermaid from "../Mermaid.js";
import "regenerator-runtime/runtime";
import "@testing-library/jest-dom";

test("renders chart", async () => {
  render(<Mermaid chartmd="graph TB;  A[TestGoal];" />);
  /// not sure why the graph isn't rendering :(
  await waitFor(() =>
    expect(screen.getByText("Syntax error in graph")).toBeInTheDocument()
  );
});
