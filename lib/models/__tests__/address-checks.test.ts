import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "../address-checks";

describe("isBlockedAddress", () => {
	it.each([
		["0.0.0.0", "this network"],
		["0.1.2.3", "this network"],
		["10.0.0.1", "10/8"],
		["10.255.255.255", "10/8"],
		["100.64.0.1", "100.64/10"],
		["100.127.255.255", "100.64/10"],
		["127.0.0.1", "127/8"],
		["127.255.255.254", "127/8"],
		["169.254.169.254", "link-local and cloud metadata"],
		["168.63.129.16", "Azure platform address"],
		["172.16.0.1", "172.16/12"],
		["172.31.255.255", "172.16/12"],
		["192.0.0.9", "protocol assignments"],
		["192.168.1.1", "192.168/16"],
		["198.19.255.255", "benchmarking"],
		["224.0.0.1", "multicast"],
		["239.255.255.255", "multicast"],
		["240.0.0.1", "reserved"],
		["255.255.255.255", "broadcast"],
	])("blocks the IPv4 address %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each([
		"1.1.1.1",
		"8.8.8.8",
		"93.184.216.34",
		"100.63.255.255",
		"100.128.0.0",
		"169.253.255.255",
		"168.63.129.15",
		"168.63.129.17",
		"168.63.128.16",
		"172.15.255.255",
		"172.32.0.0",
		"192.169.0.1",
		"198.17.255.255",
		"198.20.0.0",
		"223.255.255.255",
	])("allows the public IPv4 address %s", (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});

	it.each([
		["::", "unspecified"],
		["::1", "loopback"],
		["fc00::1", "unique local"],
		["fdff:ffff:ffff::1", "unique local"],
		["fe80::1", "link-local"],
		["febf::1", "link-local"],
		["fe80::1%eth0", "link-local with a zone"],
		["fec0::1", "site-local"],
		["ff00::1", "multicast"],
		["ff02::1", "multicast"],
		["[::1]", "loopback in URL brackets"],
		["::ffff:127.0.0.1", "mapped loopback"],
		["::ffff:7f00:1", "mapped loopback in hex"],
		["::ffff:10.1.2.3", "mapped private"],
		["::ffff:a01:203", "mapped private in hex"],
		["::ffff:169.254.169.254", "mapped metadata"],
		["::ffff:a9fe:a9fe", "mapped metadata in hex"],
		["::ffff:224.0.0.1", "mapped multicast"],
		["::127.0.0.1", "IPv4-compatible loopback"],
		["::ffff:0:7f00:1", "translated loopback"],
		["64:ff9b::7f00:1", "NAT64 loopback"],
		["64:ff9b::169.254.169.254", "NAT64 metadata"],
		["64:ff9b:1::a00:1", "local-use NAT64 private"],
		["::ffff:a83f:8110", "mapped Azure platform address"],
		["2002::", "6to4"],
		["2002:808:808::1", "6to4 carrying a public IPv4 address"],
		["2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "6to4 upper bound"],
		["2001::", "Teredo"],
		["2001:0:4136:e378:8000:63bf:3fff:fdd2", "Teredo with a client address"],
		["2001:0:ffff:ffff:ffff:ffff:ffff:ffff", "Teredo upper bound"],
	])("blocks the IPv6 address %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each([
		"2606:4700:4700::1111",
		"2001:4860:4860::8888",
		"2001:1::1",
		"2003::1",
		"2001:db9::1",
		"fbff::1",
		"::ffff:8.8.8.8",
		"::ffff:808:808",
		"64:ff9b::808:808",
	])("allows the public IPv6 address %s", (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});

	it.each([
		"",
		"example.com",
		"1.2.3",
		"256.1.1.1",
		"010.0.0.1",
		"1.2.3.4.5",
		"::g",
		"1:2:3:4:5:6:7:8:9",
		"1::2::3",
	])("blocks %j because it is not an address", (text) => {
		expect(isBlockedAddress(text)).toBe(true);
	});

	it.each([
		["1.2.3.4:5::", "an IPv4 tail that is not the last group"],
		["::1.2.3.4:5", "an IPv4 tail that is not the last group, after ::"],
		["2606:4700::1.2.3", "an IPv4 tail with three parts"],
		["2606:4700::256.1.1.1", "an IPv4 tail with an octet out of range"],
		["1:2:3:4:5::6:7:8:9", "more groups than fit around ::"],
		["1:2:3:4:5:6:7", "seven groups without ::"],
		["2606:4700:4700::1111]", "a closing bracket only"],
		["[2606:4700:4700::1111", "an opening bracket only"],
	])("blocks the malformed IPv6 text %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(true);
	});

	it.each([
		["2606:4700:4700:0:0:0:0:1111", "eight groups written in full"],
		["2606:4700:4700::1111%eth0", "a zone suffix"],
		["[2606:4700:4700::1111]", "URL brackets"],
		["1:2:3:4:5:6:7:1", "no leading zero groups"],
		["1:ff9b::7f00:1", "the NAT64 second group under another first group"],
		["64:1::7f00:1", "the NAT64 first group under another second group"],
		["64:ff9b:2::7f00:1", "a NAT64 prefix with a third group of 2"],
		["64:ff9b:0:1::7f00:1", "a NAT64 prefix with a non-zero fourth group"],
		["64:ff9b::1:0:7f00:1", "a NAT64 prefix with a non-zero fifth group"],
		["64:ff9b::1:7f00:1", "a NAT64 prefix with a non-zero sixth group"],
		["2606:4700:1::7f00:1", "a third group of 1 outside NAT64"],
		[
			"2606:4700:0:0:0:ffff:7f00:1",
			"a sixth group of ffff outside ::ffff:0:0/96",
		],
		["::1:7f00:1", "five zero groups followed by a sixth group of 1"],
		[
			"2606:4700:0:0:ffff:0:7f00:1",
			"a fifth group of ffff outside ::ffff:0:0/96",
		],
		["::1:0:7f00:1", "four zero groups followed by a fifth group of 1"],
		["::ffff:1:7f00:1", "a fifth group of ffff with a non-zero sixth group"],
	])("allows the public IPv6 address %s (%s)", (address) => {
		expect(isBlockedAddress(address)).toBe(false);
	});
});
