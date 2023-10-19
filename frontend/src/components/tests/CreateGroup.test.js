/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { fireEvent } from "@testing-library/react";
import React from "react";
import CreateGroup from "../CreateGroup.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders group creator layer", () => {
  localStorage.setItem("token", "dummy");
  render(<CreateGroup />);
  const button = screen.getByText("Create group");
  expect(button).toBeInTheDocument();
});

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
  }),
);

test("renders input for group name", () => {
  render(<CreateGroup />);
  const input = screen.getByRole("textbox", { name: /new-group-name/i });
  expect(input).toBeInTheDocument();
});

test("can type into input", () => {
  render(<CreateGroup />);
  const input = screen.getByRole("textbox", { name: /new-group-name/i });
  fireEvent.change(input, { target: { value: "New Group" } });
  expect(input.value).toBe("New Group");
});

test("submitting form makes fetch request", async () => {
  render(<CreateGroup />);
  const input = screen.getByRole("textbox", { name: /new-group-name/i });
  fireEvent.change(input, { target: { value: "New Group" } });

  const button = screen.getByRole("button", { name: /create group/i });
  fireEvent.click(button);

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/groups/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Token dummy",
    },
    body: JSON.stringify({ name: "New Group" }),
  });
});

test("input is cleared after submit", async () => {
  render(<CreateGroup />);
  const input = screen.getByRole("textbox", { name: /new-group-name/i });
  fireEvent.change(input, { target: { value: "New Group" } });

  const button = screen.getByRole("button", { name: /create group/i });
  fireEvent.click(button);

  await screen.findByRole("textbox", { name: /new-group-name/i, value: "" });
});
