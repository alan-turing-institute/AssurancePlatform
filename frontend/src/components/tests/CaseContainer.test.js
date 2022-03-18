import { render, screen } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import { Link } from "react-router-dom";
import CaseContainer from "../CaseContainer.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({ id: 1, name: "Test case", description: "", goals: [] }),
  })
);

test("renders main screen", () => {
  render(<CaseContainer />);
  // const linkElement = screen.getByText("Ethical");
  // expect(linkElement).toBeInTheDocument();
  //expect(true);
});
