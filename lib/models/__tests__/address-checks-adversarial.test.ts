import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "@/lib/models/address-checks";

describe("isBlockedAddress: addresses a request must never reach", () => {
	const blocked: [string, string][] = [
		["127.0.0.1", "loopback"],
		["127.255.255.254", "loopback, top of the block"],
		["127.1.2.3", "loopback, inside the block"],
		["0.0.0.0", "unspecified"],
		["0.1.2.3", "this network"],
		["10.0.0.1", "private 10/8"],
		["10.255.255.255", "private 10/8, top"],
		["172.16.0.0", "private 172.16/12, bottom"],
		["172.31.255.255", "private 172.16/12, top"],
		["192.168.0.1", "private 192.168/16"],
		["192.168.255.255", "private 192.168/16, top"],
		["169.254.0.0", "link-local, bottom"],
		["169.254.169.254", "cloud metadata"],
		["169.254.255.255", "link-local, top"],
		["168.63.129.16", "Azure platform address"],
		["100.64.0.0", "shared address space, bottom"],
		["100.100.100.100", "shared address space"],
		["100.127.255.255", "shared address space, top"],
		["198.18.0.0", "benchmarking, bottom"],
		["198.19.255.255", "benchmarking, top"],
		["192.0.0.1", "protocol assignments"],
		["224.0.0.1", "multicast, bottom"],
		["239.255.255.255", "multicast, top"],
		["240.0.0.1", "reserved"],
		["255.255.255.255", "broadcast"],
		["::", "IPv6 unspecified"],
		["::1", "IPv6 loopback"],
		["0:0:0:0:0:0:0:1", "IPv6 loopback, long form"],
		["fe80::1", "IPv6 link-local"],
		["FE80::1", "IPv6 link-local, upper case"],
		["febf::1", "IPv6 link-local, top of fe80::/10"],
		["fe80::1%eth0", "IPv6 link-local with a zone"],
		["fec0::1", "IPv6 site-local"],
		["fc00::1", "IPv6 unique-local, bottom"],
		["fd12:3456:789a::1", "IPv6 unique-local"],
		["fdff:ffff::1", "IPv6 unique-local, top"],
		["ff02::1", "IPv6 multicast, link"],
		["ff0e::1", "IPv6 multicast, global"],
		["ffff::1", "IPv6 multicast, top"],
		["2002:7f00:1::", "6to4 carrying loopback"],
		["2002:a9fe:a9fe::1", "6to4 carrying the metadata address"],
		["2002:0808:0808::1", "6to4 carrying a public address"],
		["2001:0:4136:e378:8000:63bf:3fff:fdd2", "Teredo"],
		["2001::1", "Teredo, short form"],
		["::ffff:127.0.0.1", "IPv4-mapped loopback"],
		["::ffff:7f00:1", "IPv4-mapped loopback in hex groups"],
		["::FFFF:7F00:1", "IPv4-mapped loopback, upper case"],
		["0:0:0:0:0:ffff:7f00:1", "IPv4-mapped loopback, long form"],
		["::ffff:169.254.169.254", "IPv4-mapped metadata address"],
		["::ffff:a9fe:a9fe", "IPv4-mapped metadata address in hex groups"],
		["::ffff:168.63.129.16", "IPv4-mapped Azure address"],
		["::ffff:10.0.0.1", "IPv4-mapped private"],
		["::ffff:192.168.1.1", "IPv4-mapped private"],
		["::ffff:100.64.0.1", "IPv4-mapped shared"],
		["::ffff:224.0.0.1", "IPv4-mapped multicast"],
		["::ffff:0.0.0.0", "IPv4-mapped unspecified"],
		["::ffff:0:127.0.0.1", "IPv4-translated loopback"],
		["::127.0.0.1", "IPv4-compatible loopback"],
		["::10.0.0.1", "IPv4-compatible private"],
		["64:ff9b::7f00:1", "NAT64 loopback"],
		["64:ff9b::a9fe:a9fe", "NAT64 metadata address"],
		["64:ff9b::10.0.0.1", "NAT64 private"],
	];

	it.each(blocked)("blocks %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each(
		blocked
	)("blocks %s (%s) written as a bracketed URL host", (address) => {
		if (address.includes("%")) {
			return;
		}
		if (address.includes(":")) {
			expect(isBlockedAddress(`[${address}]`)).toBe(true);
		}
	});

	const failClosed: [string, string][] = [
		["", "empty"],
		["localhost", "a name"],
		["example.com", "a name"],
		["1.2.3", "three groups"],
		["1.2.3.4.5", "five groups"],
		["256.1.1.1", "octet out of range"],
		["1.2.3.999", "octet out of range"],
		["010.0.0.1", "octal-looking octet"],
		["127.000.000.001", "zero-padded loopback"],
		["0x7f.0.0.1", "hex octet"],
		["2130706433", "loopback as one number"],
		["1.2.3.-4", "negative octet"],
		["1.2.3.4 ", "trailing space"],
		[":::", "malformed IPv6"],
		["1::2::3", "two gaps"],
		["12345::1", "group too long"],
		["gggg::1", "non-hex group"],
		["1:2:3:4:5:6:7", "seven groups and no gap"],
		["1:2:3:4:5:6:7:8:9", "nine groups"],
		["::ffff:999.1.1.1", "bad embedded IPv4"],
	];

	it.each(
		failClosed
	)("refuses %j (%s) because it is not a plain address", (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});
});

describe("isBlockedAddress: public addresses are allowed", () => {
	const allowed: [string, string][] = [
		["1.1.1.1", "public"],
		["8.8.8.8", "public"],
		["93.184.216.34", "public"],
		["11.0.0.1", "just above 10/8"],
		["9.255.255.255", "just below 10/8"],
		["126.255.255.255", "just below 127/8"],
		["128.0.0.1", "just above 127/8"],
		["172.15.255.255", "just below 172.16/12"],
		["172.32.0.0", "just above 172.16/12"],
		["192.167.255.255", "just below 192.168/16"],
		["192.169.0.0", "just above 192.168/16"],
		["169.253.255.255", "just below link-local"],
		["169.255.0.0", "just above link-local"],
		["168.63.129.15", "next to the Azure address"],
		["168.63.129.17", "next to the Azure address"],
		["100.63.255.255", "just below shared space"],
		["100.128.0.0", "just above shared space"],
		["198.17.255.255", "just below benchmarking"],
		["198.20.0.0", "just above benchmarking"],
		["223.255.255.255", "just below multicast"],
		["2606:4700:4700::1111", "public IPv6"],
		["2a00:1450:4009:81c::200e", "public IPv6"],
		["2001:4860:4860::8888", "public IPv6 near the Teredo prefix"],
		["2003::1", "just above 6to4"],
		["2001:1::1", "just past Teredo"],
		["fe7f::1", "just below link-local"],
		["::ffff:8.8.8.8", "IPv4-mapped public"],
		["::ffff:808:808", "IPv4-mapped public in hex groups"],
		["64:ff9b::808:808", "NAT64 public"],
	];

	it.each(allowed)("allows %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});
});
