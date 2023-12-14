/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import CaseCreator from "../CaseCreator.js";
import { MemoryRouter } from "react-router-dom";

function WrappedCaseCreator() {
  return (
    <MemoryRouter>
      <CaseCreator isOpen={true} onClose={() => {}} titleId="test-id" />
    </MemoryRouter>
  );
}

test("renders case creator layer", () => {
  localStorage.setItem("token", "dummy");
  render(<WrappedCaseCreator />);
  const textElement = screen.getByText("Create a new assurance case");
  expect(textElement).toBeInTheDocument();
});
