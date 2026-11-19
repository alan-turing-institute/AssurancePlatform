import { expect, test } from "@playwright/test";

// Public docs page: a full load of a heading address must stay on the heading.
test.use({ storageState: { cookies: [], origins: [] } });

const HEADING_PATH = "/docs/platform-guide/reference/02-element-types";

for (const heading of ["assumption", "goal", "evidence"]) {
	test(`#${heading} stays in view after the page has settled`, async ({
		page,
	}) => {
		await page.goto(`${HEADING_PATH}#${heading}`);
		await page.waitForLoadState("load");
		await page.waitForTimeout(1500);

		const scrollY = await page.evaluate(() => window.scrollY);
		expect(scrollY).toBeGreaterThan(0);
		await expect(page.locator(`#${heading}`)).toBeInViewport();
	});
}
