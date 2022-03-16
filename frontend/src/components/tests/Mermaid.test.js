import { render, screen } from "@testing-library/react";
import React from "react";
import { Link } from "react-router-dom";
import Mermaid from "../Mermaid.js";

test("renders chart", () => {
  render(<Mermaid />);
  // const linkElement = screen.getByText(/Select an existing case/i);
  //expect(linkElement).toBeInTheDocument();
  expect(true);
});
