import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CasePicker, type CasePickerOption } from "../case-picker";

const LONG_NAME = `Long ${"x".repeat(110)} end`;

function Harness({
	cases,
	initial = "",
	onChange,
}: {
	cases: CasePickerOption[];
	initial?: string;
	onChange: (id: string) => void;
}) {
	const [value, setValue] = useState(initial);
	return (
		<CasePicker
			cases={cases}
			onChange={(id) => {
				setValue(id);
				onChange(id);
			}}
			value={value}
		/>
	);
}

async function open(cases: CasePickerOption[], initial = "") {
	const onChange = vi.fn();
	const user = userEvent.setup();
	render(<Harness cases={cases} initial={initial} onChange={onChange} />);
	await user.click(screen.getByRole("combobox", { name: "Case" }));
	return { onChange, user };
}

function listed() {
	return screen.queryAllByRole("option").map((o) => o.textContent?.trim());
}

const THREE: CasePickerOption[] = [
	{ id: "id-1", name: "Alpha model" },
	{ id: "id-2", name: "Beta Model" },
	{ id: "id-3", name: "Gamma" },
];

describe("CasePicker filtering", () => {
	it("narrows the list as the user types, ignoring case", async () => {
		const { user } = await open(THREE);
		await user.type(screen.getByPlaceholderText("Search cases"), "MODEL");
		expect(listed()).toEqual(["Alpha model", "Beta Model"]);
	});

	it("ignores surrounding spaces in the search text", async () => {
		const { user } = await open(THREE);
		await user.type(screen.getByPlaceholderText("Search cases"), "  gamma ");
		expect(listed()).toEqual(["Gamma"]);
	});

	it("does not match on the case id", async () => {
		const { user } = await open(THREE);
		await user.type(screen.getByPlaceholderText("Search cases"), "id-2");
		expect(listed()).toEqual([]);
		expect(screen.getByText("No case matches.")).toBeTruthy();
	});

	it("treats pattern characters in the search as plain text", async () => {
		const { user } = await open([
			{ id: "p1", name: "Costs (draft) [v2]" },
			{ id: "p2", name: "Costs final" },
		]);
		await user.type(screen.getByPlaceholderText("Search cases"), "(draft) [[");
		expect(listed()).toEqual(["Costs (draft) [v2]"]);
		await user.clear(screen.getByPlaceholderText("Search cases"));
		await user.type(screen.getByPlaceholderText("Search cases"), ".*");
		expect(listed()).toEqual([]);
	});

	it("lists everything again when the search is cleared", async () => {
		const { user } = await open(THREE);
		const input = screen.getByPlaceholderText("Search cases");
		await user.type(input, "zzz");
		expect(listed()).toEqual([]);
		await user.clear(input);
		expect(listed()).toHaveLength(3);
	});
});

describe("CasePicker selection", () => {
	it("keeps two cases with the same name apart and reports the id chosen", async () => {
		const { onChange, user } = await open([
			{ id: "dup-1", name: "Same name" },
			{ id: "dup-2", name: "Same name" },
		]);
		await user.click(screen.getAllByRole("option")[1] as HTMLElement);
		expect(onChange).toHaveBeenCalledExactlyOnceWith("dup-2");
	});

	it("closes after a choice and shows the chosen name on the trigger", async () => {
		const { user } = await open(THREE);
		await user.click(screen.getByRole("option", { name: "Gamma" }));
		expect(screen.queryAllByRole("option")).toHaveLength(0);
		expect(
			screen.getByRole("combobox", { name: "Case" }).textContent
		).toContain("Gamma");
	});

	it("selects the highlighted item with the keyboard", async () => {
		const { onChange, user } = await open(THREE);
		await user.type(screen.getByPlaceholderText("Search cases"), "beta");
		await user.keyboard("{Enter}");
		expect(onChange).toHaveBeenCalledExactlyOnceWith("id-2");
	});

	it("shows the placeholder when the value matches no case", () => {
		render(<CasePicker cases={THREE} onChange={vi.fn()} value="gone" />);
		expect(
			screen.getByRole("combobox", { name: "Case" }).textContent
		).toContain("Choose a case");
	});

	it("shows an empty-list message when there are no cases", async () => {
		await open([]);
		expect(screen.getByText("No case matches.")).toBeTruthy();
	});
});

describe("CasePicker long and hostile names", () => {
	it("holds a 120-character name whole in its option", async () => {
		await open([{ id: "l", name: LONG_NAME }, ...THREE]);
		const option = screen.getByRole("option", { name: LONG_NAME });
		expect(within(option).getByText(LONG_NAME).textContent).toBe(LONG_NAME);
	});

	it("renders markup in a name as text", async () => {
		const name = "<img src=x onerror=alert(1)> case";
		await open([{ id: "h", name }]);
		const option = screen.getByRole("option");
		expect(option.querySelector("img")).toBeNull();
		expect(option.textContent).toContain(name);
	});

	it("filters sixty cases down to the typed one", async () => {
		const sixty = Array.from({ length: 60 }, (_, i) => ({
			id: `c${i}`,
			name: `Case number ${i}`,
		}));
		const { user } = await open(sixty);
		expect(listed()).toHaveLength(60);
		await user.type(screen.getByPlaceholderText("Search cases"), "number 59");
		expect(listed()).toEqual(["Case number 59"]);
	});
});
