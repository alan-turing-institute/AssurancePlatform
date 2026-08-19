// TEMPORARY diagnostic spec (cid, 2026-08-19) — sector still not hydrating for Chris
// on the fix branch. Captures API response, combobox text, option selection. Delete after use.
import { signIn, test } from "./helpers/auth";

const CASE_NAME_PATTERN = /DARTER Demo/;

test("diag: sector hydration on the DARTER case (fix branch)", async ({
	page,
	seedPassword,
}) => {
	const notes: string[] = [];
	page.on("pageerror", (err) => notes.push(`[pageerror] ${err.message}`));
	page.on("console", (msg) => {
		if (msg.type() === "error" || msg.type() === "warning") {
			notes.push(`[console.${msg.type()}] ${msg.text().slice(0, 300)}`);
		}
	});
	page.on("response", async (res) => {
		if (
			res.url().includes("/information") &&
			res.request().method() === "GET"
		) {
			const body = await res.text().catch(() => "<unreadable>");
			notes.push(`[api] ${res.status()} ${res.url()} -> ${body.slice(0, 400)}`);
		}
	});

	await signIn(page, "chris", seedPassword);
	await page.getByText(CASE_NAME_PATTERN).first().click();
	await page.waitForTimeout(4000);
	await page.getByRole("button", { name: CASE_NAME_PATTERN }).first().click();
	await page.waitForTimeout(4000);

	const comboboxes = page.getByRole("combobox");
	const comboCount = await comboboxes.count();
	notes.push(`[ui] combobox count: ${comboCount}`);
	for (let i = 0; i < comboCount; i++) {
		notes.push(
			`[ui] combobox[${i}] text: ${await comboboxes.nth(i).textContent()}`
		);
	}

	await comboboxes.first().click();
	await page.waitForTimeout(1000);
	const options = page.getByRole("option");
	const optionCount = await options.count();
	notes.push(`[ui] option count when open: ${optionCount}`);
	for (let i = 0; i < optionCount; i++) {
		if ((await options.nth(i).getAttribute("aria-selected")) === "true") {
			notes.push(`[ui] SELECTED option: ${await options.nth(i).textContent()}`);
		}
	}
	notes.push("[ui] (no SELECTED line above means nothing is selected)");

	for (const n of notes) {
		console.log("DIAG >>>", n);
	}
});
