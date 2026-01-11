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
	}
}
