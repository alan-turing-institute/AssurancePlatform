/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Groups from "../Groups.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        member: [
          {
            id: 1,
            name: "Group 1",
          },
        ],
        owner: [
          {
            id: 1,
            name: "Group  1",
          },
        ],
      }),
  }),
);
const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders groups layer", () => {
  localStorage.setItem("token", "dummy");
  render(<Groups />);
  const text = screen.getByText("Groups you own");
  expect(text).toBeInTheDocument();
});
