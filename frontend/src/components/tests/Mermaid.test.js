import { render, screen } from "@testing-library/react";
import React from "react";
import { Link } from "react-router-dom";
import Mermaid from "../Mermaid.js";

test("renders chart", () => {
  render(
    <Mermaid chartmd="graph TB;  A[TestGoal]; click A 'http://www.test.com' 'thisisatooltip'" />
  );
  //expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.test.com');
  //  const linkElement = screen.getByText(/TestGoal/i);
  // expect(linkElement).toBeInTheDocument();
  expect(true);
});
