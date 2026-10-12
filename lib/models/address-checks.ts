const HEX_GROUP = /^[0-9a-f]{1,4}$/;
const IPV4_OCTET = /^(0|[1-9]\d{0,2})$/;

const OCTET_VALUES = 256;
const GROUP_VALUES = 65_536;
const IPV4_OCTET_MAX = 255;
const GROUP_MAX = 65_535;
const IPV4_BITS = 32;
const IPV6_BITS_PER_GROUP = 16;
const IPV6_GROUPS = 8;

function ipv4Number(a: number, b: number, c: number, d: number): number {
	return ((a * OCTET_VALUES + b) * OCTET_VALUES + c) * OCTET_VALUES + d;
}

/** A dotted-quad IPv4 address as an unsigned 32-bit number, or null when it is not one. */
function parseIPv4(address: string): number | null {
	const parts = address.split(".");
	if (parts.length !== 4) {
		return null;
	}
	const octets: number[] = [];
	for (const part of parts) {
		if (!IPV4_OCTET.test(part) || Number(part) > IPV4_OCTET_MAX) {
			return null;
		}
		octets.push(Number(part));
	}
	const [a = 0, b = 0, c = 0, d = 0] = octets;
	return ipv4Number(a, b, c, d);
}

/** True when two values fall in the same block of `size` consecutive values. */
function sameBlock(value: number, other: number, size: number): boolean {
	return Math.floor(value / size) === Math.floor(other / size);
}

/** Each entry is a network address and its prefix length. */
const BLOCKED_IPV4_RANGES: readonly (readonly [number, number])[] = [
	// "This network".
	[ipv4Number(0, 0, 0, 0), 8],
	// Private use.
	[ipv4Number(10, 0, 0, 0), 8],
	// Shared address space (carrier-grade NAT).
	[ipv4Number(100, 64, 0, 0), 10],
	// Loopback.
	[ipv4Number(127, 0, 0, 0), 8],
	// Link-local, which includes the 169.254.169.254 cloud metadata address.
	[ipv4Number(169, 254, 0, 0), 16],
	// Private use.
	[ipv4Number(172, 16, 0, 0), 12],
	// Protocol assignments.
	[ipv4Number(192, 0, 0, 0), 24],
	// Private use.
	[ipv4Number(192, 168, 0, 0), 16],
	// Network benchmarking.
	[ipv4Number(198, 18, 0, 0), 15],
	// Multicast.
	[ipv4Number(224, 0, 0, 0), 4],
	// Reserved, which includes the 255.255.255.255 broadcast address.
	[ipv4Number(240, 0, 0, 0), 4],
];

/** True for an IPv4 address in a blocked range, and for anything that is not a plain dotted-quad address. */
function isBlockedIPv4(address: string): boolean {
	const value = parseIPv4(address);
	if (value === null) {
		return true;
	}
	return BLOCKED_IPV4_RANGES.some(([network, prefix]) =>
		sameBlock(value, network, 2 ** (IPV4_BITS - prefix))
	);
}

function ipv6SegmentGroups(segment: string): number[] | null {
	if (segment === "") {
		return [];
	}
	const parts = segment.split(":");
	const groups: number[] = [];
	for (const [index, part] of parts.entries()) {
		if (part.includes(".")) {
			const embedded = parseIPv4(part);
			if (index !== parts.length - 1 || embedded === null) {
				return null;
			}
			groups.push(Math.floor(embedded / GROUP_VALUES), embedded % GROUP_VALUES);
			continue;
		}
		if (!HEX_GROUP.test(part)) {
			return null;
		}
		groups.push(Number.parseInt(part, 16));
	}
	return groups;
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not a valid one. A zone suffix is ignored. */
function parseIPv6(address: string): number[] | null {
	let text = address.toLowerCase();
	const zoneStart = text.indexOf("%");
	if (zoneStart !== -1) {
		text = text.slice(0, zoneStart);
	}
	const halves = text.split("::");
	if (halves.length > 2) {
		return null;
	}
	const head = ipv6SegmentGroups(halves[0] ?? "");
	if (head === null) {
		return null;
	}
	if (halves.length === 1) {
		return head.length === IPV6_GROUPS ? head : null;
	}
	const tail = ipv6SegmentGroups(halves[1] ?? "");
	if (tail === null) {
		return null;
	}
	const fill = IPV6_GROUPS - head.length - tail.length;
	if (fill < 0) {
		return null;
	}
	return [...head, ...new Array<number>(fill).fill(0), ...tail];
}

/** True when the first `bits` bits of a group equal those of `prefix`. */
function groupHasPrefix(group: number, prefix: number, bits: number): boolean {
	return sameBlock(group, prefix, 2 ** (IPV6_BITS_PER_GROUP - bits));
}

/**
 * The IPv4 address an IPv6 address carries, for the forms that route to an
 * IPv4 host: IPv4-compatible (::/96), IPv4-mapped (::ffff:0:0/96), the
 * translated form (::ffff:0:0:0/96) and both NAT64 prefixes (64:ff9b::/96 and
 * 64:ff9b:1::/48). The mapped form is the same address whether it is written
 * with a dotted tail or in hex groups.
 */
function embeddedIPv4(groups: readonly number[]): string | null {
	const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] =
		groups;
	const leadingZeros = (count: number) =>
		groups.slice(0, count).every((group) => group === 0);
	const nat64 = g0 === 0x64 && g1 === 0xff_9b;
	const carriesIPv4 =
		leadingZeros(6) ||
		(leadingZeros(5) && g5 === GROUP_MAX) ||
		(leadingZeros(4) && g4 === GROUP_MAX && g5 === 0) ||
		(nat64 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) ||
		(nat64 && g2 === 1);
	if (!carriesIPv4) {
		return null;
	}
	return [
		Math.floor(g6 / OCTET_VALUES),
		g6 % OCTET_VALUES,
		Math.floor(g7 / OCTET_VALUES),
		g7 % OCTET_VALUES,
	].join(".");
}

/** True for an IPv6 address in a blocked range, one that carries a blocked IPv4 address, and anything that is not a valid IPv6 address. */
function isBlockedIPv6(address: string): boolean {
	const groups = parseIPv6(address);
	if (groups === null) {
		return true;
	}
	const [g0 = 0, , , , , , , g7 = 0] = groups;
	// :: (unspecified) and ::1 (loopback).
	if (groups.slice(0, 7).every((group) => group === 0) && g7 <= 1) {
		return true;
	}
	if (
		// fc00::/7 unique local.
		groupHasPrefix(g0, 0xfc_00, 7) ||
		// fe80::/10 link-local.
		groupHasPrefix(g0, 0xfe_80, 10) ||
		// fec0::/10 site-local.
		groupHasPrefix(g0, 0xfe_c0, 10) ||
		// ff00::/8 multicast.
		groupHasPrefix(g0, 0xff_00, 8)
	) {
		return true;
	}
	const embedded = embeddedIPv4(groups);
	return embedded !== null && isBlockedIPv4(embedded);
}

/**
 * True when a connection to this address must be refused: a loopback, private,
 * link-local, shared, unspecified, multicast or reserved address of either
 * family, an IPv6 address that carries one of those IPv4 addresses, or text
 * that is not an address at all. A bracketed IPv6 host is accepted as written
 * in a URL.
 */
export function isBlockedAddress(address: string): boolean {
	const bare =
		address.startsWith("[") && address.endsWith("]")
			? address.slice(1, -1)
			: address;
	return bare.includes(":") ? isBlockedIPv6(bare) : isBlockedIPv4(bare);
}
