/**
 * The identity a visitor is counted under for rate limits and the security log.
 *
 * An IPv4 address is its own identity. An IPv6 connection normally holds a
 * whole /64 network, so counting each full address would let one visitor take
 * a fresh count per request; an IPv6 address is therefore reduced to its /64
 * network, written as the first four groups in full (four lowercase hex digits
 * each) followed by `::/64`, whatever form the address arrived in. An
 * IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) is the IPv4 address it wraps.
 *
 * `address` must already be a valid IPv4 or IPv6 address (`net.isIP`).
 */
export function visitorNetwork(address: string): string {
	if (!address.includes(":")) {
		return address;
	}
	const groups = ipv6Groups(address);
	const mapped = mappedIpv4(groups);
	if (mapped) {
		return mapped;
	}
	const network = groups
		.slice(0, 4)
		.map((group) => group.toString(16).padStart(4, "0"));
	return `${network.join(":")}::/64`;
}

/** The dotted IPv4 address inside an IPv4-mapped IPv6 address, or null. */
function mappedIpv4(groups: readonly number[]): string | null {
	const isMapped =
		groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xff_ff;
	if (!isMapped) {
		return null;
	}
	return groups
		.slice(6)
		.flatMap((group) => [Math.floor(group / 256), group % 256])
		.join(".");
}

/** The eight 16-bit groups of a valid IPv6 address, with `::` expanded. */
function ipv6Groups(address: string): number[] {
	const withoutZone = address.split("%")[0] ?? address;
	const text = embeddedIpv4AsGroups(withoutZone);
	const [head = "", tail] = text.split("::");
	const headGroups = groupsOf(head);
	if (tail === undefined) {
		return headGroups;
	}
	const tailGroups = groupsOf(tail);
	const zeros = new Array<number>(8 - headGroups.length - tailGroups.length);
	return [...headGroups, ...zeros.fill(0), ...tailGroups];
}

function groupsOf(part: string): number[] {
	return part === ""
		? []
		: part.split(":").map((group) => Number.parseInt(group, 16));
}

/** Rewrites a trailing dotted IPv4 part (`::ffff:1.2.3.4`) as two hex groups. */
function embeddedIpv4AsGroups(text: string): string {
	const lastColon = text.lastIndexOf(":");
	const tail = text.slice(lastColon + 1);
	if (!tail.includes(".")) {
		return text;
	}
	const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
	const high = (a * 256 + b).toString(16);
	const low = (c * 256 + d).toString(16);
	return `${text.slice(0, lastColon + 1)}${high}:${low}`;
}
