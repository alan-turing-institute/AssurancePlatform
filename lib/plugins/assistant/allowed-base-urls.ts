/**
 * The base URLs an OpenAI-compatible provider may use, from the
 * comma-separated `ASSISTANT_ALLOWED_BASE_URLS` environment variable. Users
 * choose from this list; they never type a URL.
 */
export function listAllowedBaseUrls(): string[] {
	const raw = process.env.ASSISTANT_ALLOWED_BASE_URLS;
	if (!raw) {
		return [];
	}
	return raw
		.split(",")
		.map((url) => url.trim())
		.filter(Boolean);
}
