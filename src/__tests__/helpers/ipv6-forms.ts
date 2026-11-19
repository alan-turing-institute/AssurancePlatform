/**
 * Random IPv6 addresses written in many valid ways, each with the identity a
 * visitor at that address must be counted under: their /64 network written as
 * four full groups and `::/64`, or the IPv4 address inside an IPv4-mapped
 * address. The expectation is computed here from the sixteen-bit groups, never
 * from the code under test, and the generator is seeded so a failure repeats.
 */

export interface Ipv6Sample {
	expected: string;
	spelling: string;
}

type Next = () => number;

const GROUPS = 8;

/** A small seeded generator (a linear congruential one), returning numbers in [0, 1). */
function seeded(seed: number): Next {
	const modulus = 4_294_967_296;
	let state = seed % modulus;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % modulus;
		return state / modulus;
	};
}

function pick(next: Next, count: number): number {
	return Math.floor(next() * count);
}

function randomGroup(next: Next): number {
	const roll = next();
	if (roll < 0.45) {
		return 0;
	}
	if (roll < 0.6) {
		return 0xff_ff;
	}
	return roll < 0.75 ? 1 + pick(next, 15) : pick(next, 0x1_00_00);
}

function randomGroups(next: Next): number[] {
	const groups = Array.from({ length: GROUPS }, () => randomGroup(next));
	const roll = next();
	if (roll < 0.15) {
		groups.fill(0, 0, 5);
		groups[5] = 0xff_ff;
	} else if (roll < 0.25) {
		groups.fill(0, 0, 5);
		groups[pick(next, 5)] = 1 + pick(next, 0xff_ff);
		groups[5] = 0xff_ff;
	}
	return groups;
}

function dotted(high: number, low: number): string {
	return [
		Math.floor(high / 256),
		high % 256,
		Math.floor(low / 256),
		low % 256,
	].join(".");
}

function hex4(group: number): string {
	return group.toString(16).padStart(4, "0");
}

/** The identity the visitor must be counted under. */
function expectedIdentity(groups: readonly number[]): string {
	const mapped =
		groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xff_ff;
	if (mapped) {
		return dotted(groups[6] ?? 0, groups[7] ?? 0);
	}
	return `${groups.slice(0, 4).map(hex4).join(":")}::/64`;
}

/** Every run of zero groups that could be written as `::`, as [start, end). */
function zeroRuns(
	groups: readonly number[],
	limit: number
): [number, number][] {
	const runs: [number, number][] = [];
	for (let start = 0; start < limit; start++) {
		for (let end = start + 1; end <= limit && groups[end - 1] === 0; end++) {
			runs.push([start, end]);
		}
	}
	return runs;
}

function groupToken(group: number, next: Next, padded: boolean): string {
	const text = padded ? hex4(group) : group.toString(16);
	return next() < 0.5 ? text : text.toUpperCase();
}

/** One valid spelling of the address, chosen at random. */
function spell(groups: readonly number[], next: Next): string {
	const padded = next() < 0.3;
	const embedded = next() < 0.3;
	const written = embedded ? GROUPS - 2 : GROUPS;
	const tokens = groups
		.slice(0, written)
		.map((group) => groupToken(group, next, padded));
	if (embedded) {
		tokens.push(dotted(groups[6] ?? 0, groups[7] ?? 0));
	}
	const runs = zeroRuns(groups, written);
	const run = next() < 0.6 ? runs[pick(next, runs.length)] : undefined;
	const text = run
		? `${tokens.slice(0, run[0]).join(":")}::${tokens.slice(run[1]).join(":")}`
		: tokens.join(":");
	return next() < 0.1 ? `${text}%eth0` : text;
}

/** `count` random addresses, each with a valid spelling and its identity. */
export function ipv6Samples(seed: number, count: number): Ipv6Sample[] {
	const next = seeded(seed);
	return Array.from({ length: count }, () => {
		const groups = randomGroups(next);
		return {
			spelling: spell(groups, next),
			expected: expectedIdentity(groups),
		};
	});
}
