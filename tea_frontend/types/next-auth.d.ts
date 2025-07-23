import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
	interface Session extends DefaultSession {
		key?: string;
		provider?: string;
		keyExpires?: number;
	}

	interface User {
		key?: string;
		provider?: string;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		key?: string;
		provider?: string;
		keyExpires?: number;
	}
}
