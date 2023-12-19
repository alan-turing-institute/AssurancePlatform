/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "regenerator-runtime/runtime";
import React from "react";
import ItemEditor from "../ItemEditor.js";
import userEvent from "@testing-library/user-event";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        id: 1,
        name: "G1",
        short_description: "short",
        long_description: "long",
        keywords: "key",
      }),
  })
);

function WrappedItemEditor({ ...props }) {
  return (
    <ItemEditor
      caseId="1"
      onRefresh={() => {}}
      onHide={() => {}}
      getIdForNewElement={() => "New"}
      {...props}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("token", "dummy");
});

test("renders item editor layer", async () => {
  render(<WrappedItemEditor type="TopLevelNormativeGoal" id="1" />);
  const header = await screen.findByText("Editing: G1");
  expect(header).toBeInTheDocument();
});

test("updates item properties correctly", async () => {
  render(<WrappedItemEditor type="TopLevelNormativeGoal" id="1" />);

  await screen.findByText("Editing: G1");
  const shortDescInput = screen.getByLabelText("Description", { exact: false });

  userEvent.clear(shortDescInput);
  userEvent.type(shortDescInput, "Updated short");

  expect(shortDescInput.value).toBe("Updated short");
});

test("renders delete item button", async () => {
  render(<WrappedItemEditor type="TopLevelNormativeGoal" id="1" />);
  const deleteButton = await screen.findByText("Delete Goal");
  expect(deleteButton).toBeInTheDocument();
});
