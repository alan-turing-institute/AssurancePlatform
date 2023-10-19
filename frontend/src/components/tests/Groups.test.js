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

test("renders owner groups", async () => {
  render(<Groups />);
  const groupName = await screen.findByText("Group 1");
  expect(groupName).toBeInTheDocument();
});

test("renders member groups", async () => {
  render(<Groups />);
  const memberGroupName = await screen.findByText("Group 1");
  expect(memberGroupName).toBeInTheDocument();
});

test("renders group creation button", () => {
  render(<Groups />);
  const createButton = screen.getByRole("button", {
    name: /create new group/i,
  });
  expect(createButton).toBeInTheDocument();
});

test("renders manage members button for owned groups", async () => {
  render(<Groups />);
  const manageButton = await screen.findByRole("button", {
    name: /manage members/i,
  });
  expect(manageButton).toBeInTheDocument();
});

test("renders delete button for owned groups", async () => {
  render(<Groups />);
  const deleteButton = await screen.findByRole("button", { name: /delete/i });
  expect(deleteButton).toBeInTheDocument();
});

test("doesn't render manage or delete buttons for member groups", async () => {
  render(<Groups />);
  const manageButtons = screen.queryAllByRole("button", {
    name: /manage members/i,
  });
  const deleteButtons = screen.queryAllByRole("button", { name: /delete/i });
  expect(manageButtons.length).toBe(1);
  expect(deleteButtons.length).toBe(1);
});

test("shows member management layer when manage members button is clicked", async () => {
  render(<Groups />);
  const manageButton = await screen.findByRole("button", {
    name: /manage members/i,
  });
  fireEvent.click(manageButton);

  const memberManagementText = screen.getByText("Members of Group 1");
  expect(memberManagementText).toBeInTheDocument();
});

test("renders 'Groups you are member of' section", () => {
  render(<Groups />);
  const text = screen.getByText("Groups you are member of");
  expect(text).toBeInTheDocument();
});
