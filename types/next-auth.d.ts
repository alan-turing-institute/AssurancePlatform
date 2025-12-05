import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
	interface Session extends DefaultSession {
		key?: string;
		provider?: string;
		keyExpires?: number;
		user?: DefaultSession["user"] & {
			id?: string;
		};
	}

	// biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
	interface User {
		id?: string;
		key?: string;
		provider?: string;
	}
}

declare module "next-auth/jwt" {
	// biome-ignore lint/style/useConsistentTypeDefinitions: interface required for module augmentation
	interface JWT {
		id?: string;
		key?: string;
		provider?: string;
		keyExpires?: number;
	}
}
