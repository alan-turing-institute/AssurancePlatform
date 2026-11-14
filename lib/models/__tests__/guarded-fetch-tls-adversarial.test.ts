import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GuardedFetchError, guardedFetch } from "@/lib/models/guarded-fetch";
import { lookupReturning } from "@/src/__tests__/utils/model-adversarial-kit";

/**
 * The guard connects to an address it has checked, but still checks the
 * server's certificate. A server with a self-signed certificate is refused.
 * The certificate is made for this run and thrown away with the temp folder.
 */

function opensslAvailable(): boolean {
	try {
		execFileSync("openssl", ["version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

const available = opensslAvailable();

let server: Server | undefined;
let port = 0;
let handled = 0;
const clientErrors: string[] = [];

beforeAll(async () => {
	if (!available) {
		return;
	}
	const folder = mkdtempSync(path.join(tmpdir(), "tea-tls-"));
	const privatePem = path.join(folder, "server-private.pem");
	const certPem = path.join(folder, "server-cert.pem");
	execFileSync(
		"openssl",
		[
			"req",
			"-x509",
			"-newkey",
			"rsa:2048",
			"-nodes",
			"-keyout",
			privatePem,
			"-out",
			certPem,
			"-subj",
			"/CN=localhost",
			"-days",
			"1",
		],
		{ stdio: "ignore" }
	);
	server = createServer(
		{ key: readFileSync(privatePem), cert: readFileSync(certPem) },
		(_req, res) => {
			handled += 1;
			res.writeHead(200);
			res.end("secret answer");
		}
	);
	server.on("tlsClientError", (error) => {
		clientErrors.push(String((error as NodeJS.ErrnoException).code));
	});
	await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
	server?.closeAllConnections();
	await new Promise<void>((resolve) => {
		if (server) {
			server.close(() => resolve());
		} else {
			resolve();
		}
	});
});

describe.skipIf(!available)("guardedFetch: certificates", () => {
	it("refuses a server whose certificate is not trusted, even at an address on the operator's list", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `https://localhost:${port}`);
		try {
			const outcome = await guardedFetch(
				`https://localhost:${port}/v1/models`,
				{ headers: { authorization: "Bearer sk-tls-SECRET" } },
				{ lookup: lookupReturning("127.0.0.1"), timeoutMs: 3000 }
			).then(
				() => null,
				(error: unknown) => error
			);
			expect(outcome).toBeInstanceOf(GuardedFetchError);
			expect((outcome as GuardedFetchError).code).toBe("request-failed");
			expect(String(outcome)).not.toContain("sk-tls-SECRET");
			expect(String(outcome)).not.toContain(String(port));
			// The handshake began and was refused by the client, so the refusal is
			// about the certificate and not about reaching the server.
			expect(clientErrors.length).toBeGreaterThan(0);
			expect(handled).toBe(0);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
