import { expect, test } from "@playwright/test";

// Public routes only — no auth needed, and a saved session would change what
// the shared header renders (see header.tsx's useSession() check).
test.use({ storageState: { cookies: [], origins: [] } });

const authRoutes = ["/login", "/register", "/forgot-password"];
const landingRoutes = ["/discover", "/privacy-policy", "/cookie-policy"];

// Regression test for issue "TEA — Public landing routes throw React #418
// hydration mismatch on any second navigation": a full navigation to a
// (landing)-group route (discover, privacy-policy, cookie-policy) threw a
// hydration error whenever the previous page in the same tab was an
// (auth)-group route (login, register, forgot-password). Root cause:
// app/(landing)/layout.tsx wrapped its children in a <div> that duplicated
// classes already on <body> in the root layout. Removing that div
// eliminated the #418 error on every auth→landing pair across four full
// 30-pair navigation-order runs. The error was timing-sensitive — it
// vanished under CPU throttling and under this suite's default parallel
// worker load — which is consistent with a hydration-timing race that the
// redundant wrapper widened, but the exact mechanism (why a prior
// auth-route navigation specifically was required) was not captured; no run
// reproduced it with the unminified React error message.
async function assertNoPageErrors(
	page: import("@playwright/test").Page,
	from: string,
	to: string
) {
	const errors: string[] = [];
	page.on("pageerror", (err) => errors.push(err.message));

	await page.goto(from);
	await page.goto(to);
	await page.waitForTimeout(500);

	expect(errors, `page errors after ${from} -> ${to}`).toEqual([]);
}

test.describe("public routes hydrate cleanly regardless of navigation order", () => {
	// Serial: on the unfixed code this suite passed falsely in 2 of 3 runs
	// under the default parallel workers on a many-core machine — parallel
	// workers load the CPU enough to hide the same race that throttling
	// hides. CI already runs at --workers=1/2, but pin it here too so a
	// local `playwright test` run can't give a false pass either.
	test.describe.configure({ mode: "serial" });

	for (const from of authRoutes) {
		for (const to of landingRoutes) {
			test(`${from} then ${to}`, async ({ page }) => {
				await assertNoPageErrors(page, from, to);
			});
		}
	}

	// Sanity control: landing-to-landing and landing-to-auth never mismatched,
	// even before the fix — keep one of each so a future regression that
	// flips the direction still gets caught.
	test("/discover then /privacy-policy", async ({ page }) => {
		await assertNoPageErrors(page, "/discover", "/privacy-policy");
	});

	test("/discover then /login", async ({ page }) => {
		await assertNoPageErrors(page, "/discover", "/login");
	});
});
