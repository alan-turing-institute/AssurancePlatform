import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchivedBadge, ArchivedOnNotice } from "../archived-status";

const NO_LONGER_UPDATES_PATTERN = /This case no longer receives updates\./;

describe("ArchivedBadge", () => {
	it("renders nothing for a live copy", () => {
		const { container } = render(<ArchivedBadge archivedAt={null} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders the Archived label for an archived copy", () => {
		render(<ArchivedBadge archivedAt="2026-09-01T00:00:00.000Z" />);
		expect(screen.getByText("Archived")).toBeInTheDocument();
	});
});

describe("ArchivedOnNotice", () => {
	it("renders nothing for a live copy", () => {
		const { container } = render(<ArchivedOnNotice archivedAt={null} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders the archived-on date and no-updates line for an archived copy", () => {
		render(<ArchivedOnNotice archivedAt="2026-09-01T00:00:00.000Z" />);
		expect(screen.getByText(NO_LONGER_UPDATES_PATTERN)).toBeInTheDocument();
	});
});
