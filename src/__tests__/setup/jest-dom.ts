import "@testing-library/jest-dom";
import {
	toBeInTheDocument,
	toHaveAttribute,
	toHaveClass,
	toHaveTextContent,
} from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

const matchers = {
	toBeInTheDocument,
	toHaveAttribute,
	toHaveClass,
	toHaveTextContent,
};

expect.extend(matchers);

afterEach(() => {
	cleanup();
});
