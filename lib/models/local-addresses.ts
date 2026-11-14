import { logger } from "@/lib/logger";

const log = logger.child({ component: "models-local-addresses" });

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

/** The origin an entry names, or null when it is not an http or https URL, or it carries a user name or password. */
function originOf(entry: string): string | null {
	if (!URL.canParse(entry)) {
		return null;
	}
	const url = new URL(entry);
	if (!WEB_PROTOCOLS.has(url.protocol) || url.username || url.password) {
		return null;
	}
	return url.origin;
}

/**
 * The origins the server may reach over plain http or on a private address,
 * from the comma-separated `TEA_MODELS_LOCAL_ADDRESSES` environment variable,
 * for example `http://host.docker.internal:11434`. Only the operator sets it.
 * Each entry is trimmed and reduced to its origin, so a path or trailing slash
 * is dropped and `http://host:80` equals `http://host`; an invalid entry is
 * dropped on its own and logged by position only, since an entry can hold a
 * credential. Read on every call so tests can change it per case.
 */
export function listLocalOrigins(): string[] {
	const raw = process.env.TEA_MODELS_LOCAL_ADDRESSES;
	if (!raw) {
		return [];
	}
	const origins = new Set<string>();
	raw.split(",").forEach((entry, index) => {
		const trimmed = entry.trim();
		if (!trimmed) {
			return;
		}
		const origin = originOf(trimmed);
		if (origin) {
			origins.add(origin);
		} else {
			log.warn("Ignoring an invalid TEA_MODELS_LOCAL_ADDRESSES entry", {
				position: index + 1,
			});
		}
	});
	return [...origins];
}
