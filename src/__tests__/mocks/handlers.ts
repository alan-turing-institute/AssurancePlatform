import { HttpResponse, http } from "msw";

export const handlers = [
	// NextAuth endpoints (these are frontend endpoints, not backend)
	http.get("/api/auth/session", () =>
		HttpResponse.json({
			user: {
				id: 1,
				name: "Test User",
				email: "test@example.com",
				key: "mock-jwt-token",
			},
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		})
	),

	http.get("/api/auth/csrf", () =>
		HttpResponse.json({ csrfToken: "mock-csrf-token" })
	),

	http.get("/api/auth/providers", () =>
		HttpResponse.json({
			github: {
				id: "github",
				name: "GitHub",
				type: "oauth",
				signinUrl: "/api/auth/signin/github",
				callbackUrl: "/api/auth/callback/github",
			},
			credentials: {
				id: "credentials",
				name: "Credentials",
				type: "credentials",
				credentials: {
					username: { label: "Username", type: "text" },
					password: { label: "Password", type: "password" },
				},
			},
		})
	),

	http.post("/api/auth/signin/credentials", async ({ request }) => {
		const body = await request.formData();
		const username = body.get("username");
		const password = body.get("password");

		if (username === "testuser" && password === "testpass") {
			return HttpResponse.json({
				url: "/dashboard",
				ok: true,
			});
		}

		return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
	}),

	http.post("/api/auth/signout", () =>
		HttpResponse.json({
			url: "/",
			ok: true,
		})
	),

	http.post("/api/auth/callback/credentials", () =>
		HttpResponse.json({
			url: "/dashboard",
			ok: true,
		})
	),

	// Templates endpoint
	http.get("/api/templates", () =>
		HttpResponse.json([
			{
				id: "minimal",
				name: "Minimal Template",
				description: "A minimal assurance case template",
			},
		])
	),

	// Fallback for unhandled requests
	http.all("*", () => new HttpResponse(null, { status: 404 })),
];
