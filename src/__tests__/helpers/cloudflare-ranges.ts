/**
 * Cloudflare's proxy ranges as published at https://www.cloudflare.com/ips-v4
 * and https://www.cloudflare.com/ips-v6, with a small reference implementation
 * of CIDR membership. Tests use it to check the app's own matcher at the edge
 * of every range, so the expectation never comes from the code under test.
 */
export const CLOUDFLARE_RANGES = [
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
	"2400:cb00::/32",
	"2606:4700::/32",
	"2803:f800::/32",
	"2405:b500::/32",
	"2405:8100::/32",
	"2a06:98c0::/29",
	"2c0f:f248::/32",
];

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const OCTET = BigInt(256);
const GROUP = BigInt(65_536);

type Bits = 32 | 128;

interface Parsed {
	bits: Bits;
	value: bigint;
}

interface RangeEdge {
	address: string;
	label: string;
}

function parseV4(address: string): bigint {
	return address
		.split(".")
		.reduce((acc, octet) => acc * OCTET + BigInt(octet), ZERO);
}

function parseV6(address: string): bigint {
	const [head, tail] = address.split("::");
	const headGroups = head ? head.split(":") : [];
	const tailGroups = tail ? tail.split(":") : [];
	const fill = new Array<string>(
		8 - headGroups.length - tailGroups.length
	).fill("0");
	return [...headGroups, ...fill, ...tailGroups].reduce(
		(acc, group) => acc * GROUP + BigInt(`0x${group}`),
		ZERO
	);
}

function parseAddress(address: string): Parsed {
	return address.includes(":")
		? { bits: 128, value: parseV6(address) }
		: { bits: 32, value: parseV4(address) };
}

function formatV4(value: bigint): string {
	return [3, 2, 1, 0]
		.map((place) => String((value / OCTET ** BigInt(place)) % OCTET))
		.join(".");
}

function formatV6(value: bigint): string {
	return Array.from({ length: 8 }, (_, index) =>
		((value / GROUP ** BigInt(7 - index)) % GROUP).toString(16)
	).join(":");
}

function format({ bits, value }: Parsed): string {
	return bits === 32 ? formatV4(value) : formatV6(value);
}

function rangeBounds(cidr: string): {
	bits: Bits;
	first: bigint;
	last: bigint;
} {
	const [address = "", length = "0"] = cidr.split("/");
	const { bits, value } = parseAddress(address);
	const size = TWO ** BigInt(bits - Number(length));
	const first = (value / size) * size;
	return { bits, first, last: first + size - ONE };
}

/** The first and last address of the range and the address on each side of it. */
export function rangeEdges(cidr: string): RangeEdge[] {
	const { bits, first, last } = rangeBounds(cidr);
	return [
		{ label: "first address", address: format({ bits, value: first }) },
		{ label: "last address", address: format({ bits, value: last }) },
		{
			label: "one before the first",
			address: format({ bits, value: first - ONE }),
		},
		{
			label: "one after the last",
			address: format({ bits, value: last + ONE }),
		},
	];
}

/** True when the address is inside one of the published ranges. */
export function isInPublishedRanges(address: string): boolean {
	const { bits, value } = parseAddress(address);
	return CLOUDFLARE_RANGES.some((cidr) => {
		const bounds = rangeBounds(cidr);
		return (
			bounds.bits === bits && value >= bounds.first && value <= bounds.last
		);
	});
}
