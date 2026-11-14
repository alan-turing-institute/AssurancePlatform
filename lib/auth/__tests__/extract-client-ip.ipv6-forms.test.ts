import { isIP } from "node:net";
import { describe, expect, it } from "vitest";
import {
	setOriginSecretForEachTest,
	visitorCountedAs,
} from "@/src/__tests__/helpers/cloudflare-headers";
import {
	type Ipv6Sample,
	ipv6Samples,
} from "@/src/__tests__/helpers/ipv6-forms";

/**
 * An IPv6 visitor behind Cloudflare is counted by their /64 network (or, for
 * an IPv4-mapped address, the IPv4 address inside it) whichever of the many
 * valid ways the address is written: compressed anywhere, padded or not,
 * upper or lower case, with a dotted IPv4 tail, with a zone id. A few hundred
 * random addresses are checked against the networks computed independently.
 */

const SEED = 20_261_109;
const SAMPLES = ipv6Samples(SEED, 600);

setOriginSecretForEachTest();

function misCounted(samples: readonly Ipv6Sample[]): string[] {
	return samples
		.map((sample) => ({
			...sample,
			counted: visitorCountedAs(sample.spelling),
		}))
		.filter((sample) => sample.counted !== sample.expected)
		.map(
			({ spelling, counted, expected }) =>
				`${spelling} was counted as ${counted}, not ${expected}`
		);
}

describe("random IPv6 visitors", () => {
	it("are valid addresses in the first place", () => {
		const invalid = SAMPLES.filter((sample) => isIP(sample.spelling) !== 6);

		expect(invalid).toEqual([]);
	});

	it("include both IPv4-mapped addresses and ordinary ones", () => {
		const mapped = SAMPLES.filter((sample) => !sample.expected.includes(":"));

		expect(mapped.length).toBeGreaterThan(30);
		expect(mapped.length).toBeLessThan(SAMPLES.length - 30);
	});

	it("are each counted as their network, however the address is written", () => {
		expect(misCounted(SAMPLES)).toEqual([]);
	});
});
