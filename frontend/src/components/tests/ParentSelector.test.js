/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ParentSelector from "../ParentSelector.js";
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
global.window.scrollTo = jest.fn();

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve([
        {
          id: 1,
          name: "PropertyClaim 1",
        },
        {
          id: 2,
          name: "PropertyClaim 2",
        },
      ]),
  }),
);


afterEach(cleanup);

test("renders parent selector layer", () => {
  localStorage.setItem("token", "dummy");
  render(<ParentSelector type="Evidence" caseId="1" />);
  const dropdown = screen.getByLabelText("Choose a parent");
  expect(dropdown).toBeInTheDocument();
});

test("renders dropdown with 'Choose a potential parent' placeholder for potential prop", () => {
  render(<ParentSelector type="Evidence" potential={true} caseId="1" />);
  const dropdown = screen.getByLabelText("Choose a potential parent");
  expect(dropdown).toBeInTheDocument();
});

test("renders options based on API response", async () => {
  render(<ParentSelector type="Evidence" caseId="1" />);
  const dropdown = await screen.findByRole("combobox");
  userEvent.click(dropdown);

  const option1 = await screen.findByText("PropertyClaim 1");
  const option2 = await screen.findByText("PropertyClaim 2");
  expect(option1).toBeInTheDocument();
  expect(option2).toBeInTheDocument();
});

// TODO: Get this test to work
// test("onChange updates selected value correctly", () => {
//   const setValueMock = jest.fn();
//   render(<ParentSelector type="Evidence" setValue={setValueMock} />);
//   const dropdown = screen.getByPlaceholderText("Choose a parent");
//   fireEvent.click(dropdown);

//   const option = screen.findByText("PropertyClaim 1");;
//   fireEvent.click(option);

//   expect(setValueMock).toHaveBeenCalledWith({ id: 1, name: "PropertyClaim 1" });
// });
