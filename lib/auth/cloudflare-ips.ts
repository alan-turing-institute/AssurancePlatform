import { BlockList, isIP } from "node:net";

/**
 * Cloudflare's published proxy address ranges, in CIDR form.
 *
 * Source: https://www.cloudflare.com/ips/ (the lists at
 * https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6).
 * Copied on 2026-11-09.
 *
 * A request counts as coming through Cloudflare only when the address that
 * connected to this app is inside one of these ranges. If Cloudflare adds a
 * range later, requests through it are not recognised and are handled as
 * ordinary requests (counted by the connecting address), never trusted more.
 */
const CLOUDFLARE_IPV4_RANGES = [
	"173.245.48.0/20",
	"103.21.244.0/22",
	"103.22.200.0/22",
	"103.31.4.0/22",
	"141.101.64.0/18",
	"108.162.192.0/18",
	"190.93.240.0/20",
	"188.114.96.0/20",
	"197.234.240.0/22",
	"198.41.128.0/17",
	"162.158.0.0/15",
	"104.16.0.0/13",
	"104.24.0.0/14",
	"172.64.0.0/13",
	"131.0.72.0/22",
];

const CLOUDFLARE_IPV6_RANGES = [
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
];

function addRanges(
	list: BlockList,
	cidrs: readonly string[],
	family: "ipv4" | "ipv6"
): void {
	for (const cidr of cidrs) {
		const slash = cidr.indexOf("/");
		list.addSubnet(cidr.slice(0, slash), Number(cidr.slice(slash + 1)), family);
	}
}

const cloudflareRanges = new BlockList();
addRanges(cloudflareRanges, CLOUDFLARE_IPV4_RANGES, "ipv4");
addRanges(cloudflareRanges, CLOUDFLARE_IPV6_RANGES, "ipv6");

/**
 * True when `address` is a valid IPv4 or IPv6 address inside one of
 * Cloudflare's published ranges. An IPv4-mapped IPv6 address
 * (`::ffff:a.b.c.d`) is matched as the IPv4 address it wraps. Anything that
 * is not a valid address is not in the ranges.
 */
export function isCloudflareAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 0) {
		return false;
	}
	return cloudflareRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}
