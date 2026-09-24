import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	interface Session extends DefaultSession {
		provider?: string;
		user?: DefaultSession["user"] & {
			id?: string;
		};
	}

	interface User {
		id?: string;
		provider?: string;
	}
}

declare module "next-auth/jwt" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
	interface JWT {
		id?: string;
		provider?: string;
		// Session version stamped at sign-in, checked on every server-side
		// session read (lib/auth/session-version.ts). A token with no claim
		// here — issued before this shipped — is rejected, not defaulted.
		sessionVersion?: number;
	}
}
