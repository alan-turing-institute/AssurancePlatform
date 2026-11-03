/**
 * Values a crafted sign-in link could carry in `redirect` or `callbackUrl`
 * that lead off-site or are not a plain same-site path. None of them reduces
 * to `/dashboard` when parsed, so a caller that skips its check ends up
 * somewhere other than `/dashboard` and the difference shows.
 */
export const OFF_SITE_REDIRECT_VALUES = [
	"https://evil.example",
	"HTTPS://EVIL.EXAMPLE/cases/1",
	"//evil.example/cases/1",
	"///evil.example",
	"/\\evil.example",
	"\\\\evil.example",
	"\\/evil.example",
	"/.//evil.example",
	"/a/..//evil.example",
	"/%2e//evil.example",
	"/\t/evil.example",
	"/\n/evil.example",
	"/\r/evil.example",
	"/cases/1\t",
	"/cases/\x001",
	" /cases/1",
	"cases/1",
	"javascript:alert(1)",
	"data:text/html,x",
];
