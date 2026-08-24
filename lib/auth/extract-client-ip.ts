/**
 * Trustworthy client-IP extraction — the ONE sanctioned way to read a
 * client IP anywhere in this codebase. Do not read `x-forwarded-for`'s
 * first hop or `x-real-ip` directly; both are attacker-controllable in
 * our deployment.
 *
 * Trust chain (Azure App Service, no CDN/Front Door in front of it):
 * 1. `x-client-ip` — set by Azure App Service's front end with the true
 *    client IP, and OVERWRITTEN if a client tries to supply it. Not
 *    spoofable in this deployment.
 * 2. `x-forwarded-for` — Azure appends the true client IP as the LAST
 *    (rightmost) entry; every entry to its left can be attacker-supplied.
 *    Entries are formatted `IP:port` (or `[IPv6]:port`); the port is
 *    stripped. If the rightmost entry is empty (e.g. a trailing comma,
 *    `"1.2.3.4, 5.6.7.8,"`) this FAILS CLOSED to `"unknown"` by design —
 *    it does not fall back to an earlier entry. Earlier entries are
 *    attacker-controllable, so falling back to one would let a caller
 *    reopen rate-limit-bucket rotation in any topology where this
 *    deployment's Azure assumptions don't hold.
 * 3. `"unknown"` if neither header is present (or both are empty/blank).
 *
 * If a CDN or Front Door is ever placed in front of App Service, this
 * trust chain must be revisited — a CDN can change which hop is safe to
 * trust, or introduce its own trusted-IP header.
 */
export function extractClientIp(headers: Headers): string {
	const clientIp = headers.get("x-client-ip")?.trim();
	if (clientIp) {
		return clientIp;
	}

	const forwardedFor = headers.get("x-forwarded-for");
	if (forwardedFor) {
		const entries = forwardedFor.split(",");
		const rightmost = entries.at(-1)?.trim() ?? "";
		if (rightmost) {
			return stripPort(rightmost);
		}
	}

	return "unknown";
}

/**
 * Strips a `:port` suffix from an `IPv4:port` or `[IPv6]:port` entry.
 * A bare IPv6 address (multiple colons, no brackets) is ambiguous between
 * "address" and "address:port" and is returned unchanged.
 */
function stripPort(entry: string): string {
	// Bracketed IPv6, optionally with a port: [::1] or [::1]:8080
	if (entry.startsWith("[")) {
		const closeBracket = entry.indexOf("]");
		if (closeBracket !== -1) {
			return entry.slice(1, closeBracket);
		}
		return entry;
	}

	// Bare IPv6 has more than one colon — leave it untouched, port or not.
	const colonCount = (entry.match(/:/g) ?? []).length;
	if (colonCount > 1) {
		return entry;
	}

	// IPv4:port or a plain host with no port.
	if (colonCount === 1) {
		return entry.slice(0, entry.indexOf(":"));
	}

	return entry;
}
