import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "../mocks/server";

beforeAll(() => {
	server.listen({ onUnhandledRequest: "warn" });

	// Set up a base URL for relative fetch requests
	const url = new URL("http://localhost:3000");
	const mockLocation = {
		href: url.href,
		origin: url.origin,
		protocol: url.protocol,
		host: url.host,
		hostname: url.hostname,
		port: url.port,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
		reload: vi.fn(),
		replace: vi.fn(),
		assign: vi.fn(),
		toString: () => url.toString(),
	};

	Object.defineProperty(window, "location", {
		value: mockLocation,
		writable: true,
		configurable: true,
	});
});

afterEach(() => {
	server.resetHandlers();
});

afterAll(() => {
	server.close();
});
