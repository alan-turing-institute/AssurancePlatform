import { describe, expect, it } from "vitest";
import { signInFormSchema } from "../user";

const PASSWORD = "Passw0rd!Passw0rd";

function parseIdentifier(identifier: string) {
	return signInFormSchema.safeParse({ identifier, password: PASSWORD });
}

describe("signInFormSchema identifier", () => {
	it("trims spaces from both ends", () => {
		const result = parseIdentifier(" demo ");
		expect(result.success).toBe(true);
		expect(result.data?.identifier).toBe("demo");
	});

	it("keeps capitals", () => {
		const result = parseIdentifier("Demo");
		expect(result.success).toBe(true);
		expect(result.data?.identifier).toBe("Demo");
	});

	it("refuses an identifier made only of spaces", () => {
		expect(parseIdentifier("     ").success).toBe(false);
	});

	it("does not trim the password", () => {
		const result = signInFormSchema.safeParse({
			identifier: "demo",
			password: ` ${PASSWORD} `,
		});
		expect(result.data?.password).toBe(` ${PASSWORD} `);
	});
});
