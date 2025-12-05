import { HttpResponse, http } from "msw";
import {
	mockCasePermission,
	mockCaseStudy,
	mockInvitation,
	mockTeam,
	mockUser,
} from "../utils/mock-data";
import { mockTeamMembers } from "../utils/team-mock-data";

// Type interfaces for request bodies
type CreateCaseRequest = {
	name: string;
	description: string;
};

type UpdateCaseRequest = {
	name?: string;
	description?: string;
	view_groups?: number[];
	edit_groups?: number[];
	review_groups?: number[];
};

type GoalRequest = {
	name: string;
	short_description?: string;
	long_description?: string;
	keywords?: string;
	assurance_case: number;
	assumption?: boolean;
};

type StrategyRequest = {
	name: string;
	short_description?: string;
	long_description?: string;
	keywords?: string;
	goal: number;
	assurance_case: number;
};

type EvidenceRequest = {
	name: string;
	short_description?: string;
	long_description?: string;
	keywords?: string;
	URL?: string;
	assurance_case: number;
};

type PermissionRequest = {
	user_id: number;
	user_name: string;
	permission_type: string;
};

type InviteRequest = {
	email: string;
};

type PropertyClaimRequest = {
	name: string;
	short_description?: string;
	long_description?: string;
	keywords?: string;
	property_claim_type?: string;
	level?: number;
	claim_type?: string;
	goal?: number;
	strategy?: number;
	assurance_case: number;
};

type ContextRequest = {
	name: string;
	short_description?: string;
	long_description?: string;
	keywords?: string;
	goal: number;
	assurance_case: number;
};

type TeamRequest = {
	name: string;
	description?: string;
};

type TeamMemberUpdateRequest = {
	name: string;
	title: string;
	department: string;
	isAdmin?: boolean;
};

type TeamMemberCreateRequest = {
	name: string;
	title: string;
	department: string;
	email: string;
	isAdmin?: boolean;
};

// Mock API base URL (should match your backend)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

	// Backend authentication endpoints
	http.post(`${API_BASE_URL}/api/auth/login/`, async ({ request }) => {
		const body = (await request.json()) as {
			username: string;
			password: string;
		};

		if (body.username === "testuser" && body.password === "testpass") {
			return HttpResponse.json({
				id: 1,
				username: "testuser",
				email: "test@example.com",
				name: "Test User",
				key: "mock-jwt-token",
			});
		}

		return new HttpResponse(null, { status: 401 });
	}),

	http.post(
		`${API_BASE_URL}/api/auth/register/`,
		() => new HttpResponse(null, { status: 204 })
	),

	http.get(`${API_BASE_URL}/api/auth/user/`, () =>
		HttpResponse.json({
			id: 1,
			username: "testuser",
			email: "test@example.com",
			first_name: "Test",
			last_name: "User",
		})
	),

	http.post(
		`${API_BASE_URL}/api/auth/github/register-by-token/`,
		async ({ request }) => {
			const body = (await request.json()) as {
				access_token: string;
				email: string;
			};

			return HttpResponse.json({
				id: 1,
				username: "githubuser",
				email: body.email || "github@example.com",
				name: "GitHub User",
				key: "mock-github-jwt-token",
			});
		}
	),

	// Assurance Cases endpoints
	http.get(`${API_BASE_URL}/api/cases/`, ({ request }) => {
		const url = new URL(request.url);
		const owner = url.searchParams.get("owner");

		if (owner === "true") {
			return HttpResponse.json([
				{
					id: 1,
					name: "Test Assurance Case",
					description: "A test case for testing",
					created_date: "2024-01-01T00:00:00Z",
					owner: 1,
					view_groups: [],
					edit_groups: [],
					review_groups: [],
					permissions: "manage",
				},
				{
					id: 2,
					name: "Another Test Case",
					description: "Another case for testing",
					created_date: "2024-01-02T00:00:00Z",
					owner: 1,
					view_groups: [],
					edit_groups: [],
					review_groups: [],
					permissions: "manage",
				},
			]);
		}

		return HttpResponse.json([]);
	}),

	http.get(`${API_BASE_URL}/api/cases/:id/`, ({ params }) => {
		const caseId = params.id ? Number.parseInt(params.id as string, 10) : 1;

		return HttpResponse.json({
			id: caseId,
			name: "Test Assurance Case",
			description: "A test case for testing",
			created_date: "2024-01-01T00:00:00Z",
			owner: 1,
			view_groups: [],
			edit_groups: [],
			review_groups: [],
			goals: [],
			property_claims: [],
			evidence: [],
			contexts: [],
			strategies: [],
		});
	}),

	http.post(`${API_BASE_URL}/api/cases/`, async ({ request }) => {
		const body = (await request.json()) as CreateCaseRequest;
		return HttpResponse.json(
			{
				id: 3,
				name: body.name,
				description: body.description,
				created_date: new Date().toISOString(),
				owner: 1,
				view_groups: [],
				edit_groups: [],
				review_groups: [],
				goals: [],
				property_claims: [],
				evidence: [],
				contexts: [],
				strategies: [],
			},
			{ status: 201 }
		);
	}),

	http.put(`${API_BASE_URL}/api/cases/:id/`, async ({ params, request }) => {
		const body = (await request.json()) as UpdateCaseRequest;
		const caseId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: caseId,
			...(typeof body === "object" && body !== null ? body : {}),
			owner: 1,
			created_date: "2024-01-01T00:00:00Z",
		});
	}),

	// Case deletion endpoint
	http.delete(`${API_BASE_URL}/api/cases/:id/`, async ({ params }) => {
		const _caseId = Number.parseInt(params.id as string, 10);
		// Add delay to allow loading state to be visible in tests
		await new Promise((resolve) => setTimeout(resolve, 500));
		return new HttpResponse(null, { status: 204 });
	}),

	// Update identifiers endpoint
	http.post(`${API_BASE_URL}/api/cases/:id/update-ids`, async ({ params }) => {
		const caseId = Number.parseInt(params.id as string, 10);
		// Add delay to allow loading state to be visible in tests
		await new Promise((resolve) => setTimeout(resolve, 100));
		return HttpResponse.json(
			{
				message: "Identifiers updated successfully",
				case_id: caseId,
			},
			{ status: 200 }
		);
	}),

	// Goals endpoints
	http.post(`${API_BASE_URL}/api/goals/`, async ({ request }) => {
		const body = (await request.json()) as GoalRequest;
		return HttpResponse.json(
			{
				id: Date.now(),
				name: body.name,
				short_description: body.short_description,
				long_description: body.long_description,
				keywords: body.keywords || "",
				assurance_case: body.assurance_case,
				assumption: body.assumption || null,
			},
			{ status: 201 }
		);
	}),

	http.put(`${API_BASE_URL}/api/goals/:id/`, async ({ params, request }) => {
		const body = (await request.json()) as GoalRequest;
		const goalId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: goalId,
			...(typeof body === "object" && body !== null ? body : {}),
		});
	}),

	// Strategies endpoints
	http.post(`${API_BASE_URL}/api/strategies/`, async ({ request }) => {
		const body = (await request.json()) as StrategyRequest;
		return HttpResponse.json(
			{
				id: Date.now(),
				name: body.name,
				short_description: body.short_description,
				long_description: body.long_description,
				goal: body.goal,
				assurance_case: body.assurance_case,
			},
			{ status: 201 }
		);
	}),

	http.put(
		`${API_BASE_URL}/api/strategies/:id/`,
		async ({ params, request }) => {
			const body = (await request.json()) as StrategyRequest;
			const strategyId = Number.parseInt(params.id as string, 10);
			return HttpResponse.json({
				id: strategyId,
				...(typeof body === "object" && body !== null ? body : {}),
			});
		}
	),

	// Evidence endpoints
	http.post(`${API_BASE_URL}/api/evidence/`, async ({ request }) => {
		const body = (await request.json()) as EvidenceRequest;
		return HttpResponse.json(
			{
				id: Date.now(),
				name: body.name,
				short_description: body.short_description,
				long_description: body.long_description,
				URL: body.URL || "",
				assurance_case: body.assurance_case,
			},
			{ status: 201 }
		);
	}),

	http.put(`${API_BASE_URL}/api/evidence/:id/`, async ({ params, request }) => {
		const body = (await request.json()) as EvidenceRequest;
		const evidenceId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: evidenceId,
			...(typeof body === "object" && body !== null ? body : {}),
		});
	}),

	// Property claims endpoints
	http.post(`${API_BASE_URL}/api/propertyclaims/`, async ({ request }) => {
		const body = (await request.json()) as PropertyClaimRequest;
		return HttpResponse.json(
			{
				id: Date.now(),
				name: body.name,
				short_description: body.short_description,
				long_description: body.long_description,
				property_claim_type: body.property_claim_type || "claim",
				level: body.level || 1,
				claim_type: body.claim_type || "claim",
				goal: body.goal || null,
				strategy: body.strategy || null,
				assurance_case: body.assurance_case,
			},
			{ status: 201 }
		);
	}),

	http.put(
		`${API_BASE_URL}/api/propertyclaims/:id/`,
		async ({ params, request }) => {
			const body = (await request.json()) as PropertyClaimRequest;
			const claimId = Number.parseInt(params.id as string, 10);
			return HttpResponse.json({
				id: claimId,
				...(typeof body === "object" && body !== null ? body : {}),
			});
		}
	),

	// Contexts endpoints
	http.post(`${API_BASE_URL}/api/contexts/`, async ({ request }) => {
		const body = (await request.json()) as ContextRequest;
		return HttpResponse.json(
			{
				id: Date.now(),
				name: body.name,
				short_description: body.short_description,
				long_description: body.long_description,
				goal: body.goal,
				assurance_case: body.assurance_case,
			},
			{ status: 201 }
		);
	}),

	http.put(`${API_BASE_URL}/api/contexts/:id/`, async ({ params, request }) => {
		const body = (await request.json()) as ContextRequest;
		const contextId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: contextId,
			...(typeof body === "object" && body !== null ? body : {}),
		});
	}),

	// Comments endpoints
	http.get(`${API_BASE_URL}/api/comments/`, () => HttpResponse.json([])),

	http.post(`${API_BASE_URL}/api/comments/`, () =>
		HttpResponse.json(
			{
				id: 1,
				content: "Test comment",
				author: 1,
				created_date: new Date().toISOString(),
			},
			{ status: 201 }
		)
	),

	// Users endpoints
	http.get(`${API_BASE_URL}/api/users/`, () =>
		HttpResponse.json([
			{
				id: 1,
				username: "testuser",
				email: "test@example.com",
				first_name: "Test",
				last_name: "User",
			},
		])
	),

	// Current user endpoint
	http.get(`${API_BASE_URL}/api/user/`, () =>
		HttpResponse.json({
			id: 1,
			username: "testuser",
			email: "test@example.com",
			first_name: "Test",
			last_name: "User",
			auth_provider: "github",
			auth_username: "testuser",
			created_date: "2024-01-01T00:00:00Z",
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

	// Screenshot endpoint - Next.js API route
	http.post("/api/screenshot", async ({ request }) => {
		const body = (await request.json()) as {
			caseId: string;
			image: string;
			token: string;
		};

		// Mock successful response from Next.js API route
		return HttpResponse.json({
			message: "Screenshot saved successfully",
			data: {
				id: Date.now(),
				case: Number.parseInt(body.caseId, 10),
				image_url: `/media/cases/${body.caseId}/screenshot.png`,
				created_date: new Date().toISOString(),
			},
		});
	}),

	// Screenshot endpoint with absolute URL - fallback
	http.post("http://localhost:3000/api/screenshot", async ({ request }) => {
		const body = (await request.json()) as {
			caseId: string;
			image: string;
			token: string;
		};

		// Mock successful response from Next.js API route
		return HttpResponse.json({
			message: "Screenshot saved successfully",
			data: {
				id: Date.now(),
				case: Number.parseInt(body.caseId, 10),
				image_url: `/media/cases/${body.caseId}/screenshot.png`,
				created_date: new Date().toISOString(),
			},
		});
	}),

	// Public API endpoints
	http.get(`${API_BASE_URL}/api/public/published-cases/`, () =>
		HttpResponse.json([])
	),

	http.get(`${API_BASE_URL}/api/published-assurance-cases/`, () =>
		HttpResponse.json([
			{
				id: 1,
				name: "Published Safety Case",
				description: "A published assurance case for public viewing",
				published_date: "2024-01-01T00:00:00Z",
				owner: 1,
				owner_name: "Test User",
			},
		])
	),

	// Public assurance case by ID
	http.get(`${API_BASE_URL}/api/public/assurance-case/:id/`, ({ params }) => {
		const caseId = params.id;
		return HttpResponse.json({
			id: caseId,
			name: "Published Assurance Case",
			description: "A published assurance case",
			published: true,
			published_date: "2024-01-01T00:00:00Z",
		});
	}),

	// GitHub integration
	http.get(`${API_BASE_URL}/api/github/repositories/`, () =>
		HttpResponse.json([])
	),

	// Case image upload endpoint
	http.post(`${API_BASE_URL}/api/cases/:id/image`, ({ params }) => {
		const caseId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			message: "Image uploaded successfully",
			data: {
				id: Date.now(),
				case: caseId,
				image_url: `/media/cases/${caseId}/screenshot.png`,
				created_date: new Date().toISOString(),
			},
		});
	}),

	// Case sharing/permissions endpoints
	http.get(`${API_BASE_URL}/api/cases/:id/sharedwith`, () =>
		HttpResponse.json({
			view: [
				{
					id: 2,
					username: "viewer",
					email: "viewer@example.com",
					first_name: "View",
					last_name: "User",
				},
			],
			edit: [
				{
					id: 3,
					username: "editor",
					email: "editor@example.com",
					first_name: "Edit",
					last_name: "User",
				},
			],
			review: [
				{
					id: 4,
					username: "reviewer",
					email: "reviewer@example.com",
					first_name: "Review",
					last_name: "User",
				},
			],
		})
	),

	http.post(`${API_BASE_URL}/api/cases/:id/sharedwith`, () =>
		HttpResponse.json({ success: true })
	),

	// Sandbox/orphaned elements endpoint
	http.get(`${API_BASE_URL}/api/cases/:id/sandbox`, () =>
		HttpResponse.json([])
	),

	// Team management endpoints
	http.get(`${API_BASE_URL}/api/teams/`, () =>
		HttpResponse.json([
			mockTeam,
			{
				id: 2,
				name: "QA Team",
				description: "Quality assurance team",
				owner: 2,
				members: [2, 3],
				created_date: "2024-01-02T00:00:00Z",
			},
		])
	),

	http.post(`${API_BASE_URL}/api/teams/`, async ({ request }) => {
		const body = (await request.json()) as TeamRequest;
		return HttpResponse.json(
			{
				id: 3,
				name: body.name,
				description: body.description || "",
				owner: mockUser.id,
				members: [mockUser.id],
				created_date: new Date().toISOString(),
			},
			{ status: 201 }
		);
	}),

	http.get(`${API_BASE_URL}/api/teams/:id/`, ({ params }) => {
		const teamId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			...mockTeam,
			id: teamId,
		});
	}),

	http.put(`${API_BASE_URL}/api/teams/:id/`, async ({ params, request }) => {
		const teamId = Number.parseInt(params.id as string, 10);
		const body = (await request.json()) as TeamRequest;
		return HttpResponse.json({
			...mockTeam,
			id: teamId,
			...(typeof body === "object" && body !== null ? body : {}),
		});
	}),

	http.delete(
		`${API_BASE_URL}/api/teams/:id/`,
		() => new HttpResponse(null, { status: 204 })
	),

	// Invitation endpoints
	http.post(
		`${API_BASE_URL}/api/teams/:id/invite/`,
		async ({ params, request }) => {
			const teamId = Number.parseInt(params.id as string, 10);
			const body = (await request.json()) as InviteRequest;
			return HttpResponse.json(
				{
					...mockInvitation,
					id: Date.now(),
					team: teamId,
					invitee_email: body.email,
					created_date: new Date().toISOString(),
				},
				{ status: 201 }
			);
		}
	),

	http.get(`${API_BASE_URL}/api/invitations/`, () =>
		HttpResponse.json([
			mockInvitation,
			{
				...mockInvitation,
				id: 2,
				status: "accepted",
				invitee_email: "accepted@example.com",
			},
		])
	),

	http.post(`${API_BASE_URL}/api/invitations/:id/accept/`, ({ params }) => {
		const invitationId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			...mockInvitation,
			id: invitationId,
			status: "accepted",
		});
	}),

	http.post(`${API_BASE_URL}/api/invitations/:id/reject/`, ({ params }) => {
		const invitationId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			...mockInvitation,
			id: invitationId,
			status: "rejected",
		});
	}),

	// Additional permission endpoints
	http.get(`${API_BASE_URL}/api/cases/:id/permissions/`, ({ params }) => {
		const caseId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json([
			{
				...mockCasePermission,
				case: caseId,
			},
			{
				id: 2,
				case: caseId,
				user: 3,
				user_name: "Editor User",
				permission_type: "edit",
				created_date: "2024-01-02T00:00:00Z",
			},
		]);
	}),

	http.post(
		`${API_BASE_URL}/api/cases/:id/permissions/`,
		async ({ params, request }) => {
			const caseId = Number.parseInt(params.id as string, 10);
			const body = (await request.json()) as PermissionRequest;
			return HttpResponse.json(
				{
					id: Date.now(),
					case: caseId,
					user: body.user_id,
					user_name: body.user_name || "New User",
					permission_type: body.permission_type,
					created_date: new Date().toISOString(),
				},
				{ status: 201 }
			);
		}
	),

	http.put(
		`${API_BASE_URL}/api/cases/:id/permissions/:permId/`,
		async ({ params, request }) => {
			const caseId = Number.parseInt(params.id as string, 10);
			const permId = Number.parseInt(params.permId as string, 10);
			const body = (await request.json()) as PermissionRequest;
			return HttpResponse.json({
				...mockCasePermission,
				id: permId,
				case: caseId,
				permission_type: body.permission_type,
			});
		}
	),

	http.delete(
		`${API_BASE_URL}/api/cases/:id/permissions/:permId/`,
		() => new HttpResponse(null, { status: 204 })
	),

	// Case study endpoints
	http.get(`${API_BASE_URL}/api/case-studies/`, () =>
		HttpResponse.json([
			mockCaseStudy,
			{
				id: 2,
				title: "Advanced Case Study",
				description: "An advanced case study for experts",
				content: "Advanced case study content...",
				type: "research",
				owner: mockUser.id,
				created_date: "2024-01-02T00:00:00Z",
				image: "/images/case-study-2.jpg",
			},
		])
	),

	http.post(`${API_BASE_URL}/api/case-studies/`, async ({ request }) => {
		const body = await request.formData();
		return HttpResponse.json(
			{
				id: Date.now(),
				title: body.get("title") || "Default Title",
				description: body.get("description") || "",
				content: body.get("content") || "",
				type: body.get("type") || "learning",
				owner: mockUser.id,
				created_date: new Date().toISOString(),
				image: body.get("image") ? "/media/case-studies/123/image.png" : null,
			},
			{ status: 201 }
		);
	}),

	// Update case study endpoint
	http.put(
		`${API_BASE_URL}/api/case-studies/:id/`,
		async ({ params, request }) => {
			const caseStudyId = Number.parseInt(params.id as string, 10);
			const body = await request.formData();
			return HttpResponse.json({
				id: caseStudyId,
				title: body.get("title") || "Updated Title",
				description: body.get("description") || "",
				content: body.get("content") || "",
				type: body.get("type") || "learning",
				owner: mockUser.id,
				updated_date: new Date().toISOString(),
				image: body.get("image")
					? `/media/case-studies/${caseStudyId}/image.png`
					: null,
			});
		}
	),

	// Delete case study endpoint
	http.delete(`${API_BASE_URL}/api/case-studies/:id/`, ({ params }) => {
		const _caseStudyId = Number.parseInt(params.id as string, 10);
		return new HttpResponse(null, { status: 204 });
	}),

	// Get case study by ID endpoint
	http.get(`${API_BASE_URL}/api/case-studies/:id/`, ({ params }) => {
		const caseStudyId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: caseStudyId,
			title: "Private Case Study",
			description: "A private case study",
			type: "learning",
			owner: mockUser.id,
			created_date: "2024-01-01T00:00:00Z",
		});
	}),

	http.get(`${API_BASE_URL}/api/public/case-studies/`, () =>
		HttpResponse.json([
			{
				...mockCaseStudy,
				published: true,
				published_date: "2024-01-01T00:00:00Z",
			},
			{
				id: 3,
				title: "Public Safety Case Study",
				description: "A publicly available case study on safety",
				content: "Public safety case study content...",
				type: "reference",
				owner: 2,
				created_date: "2024-01-03T00:00:00Z",
				published: true,
				published_date: "2024-01-04T00:00:00Z",
				image: "/images/public-case-study.jpg",
			},
		])
	),

	// Public case study by ID
	http.get(`${API_BASE_URL}/api/public/case-studies/:id`, ({ params }) => {
		const caseStudyId = Number.parseInt(params.id as string, 10);
		return HttpResponse.json({
			id: caseStudyId,
			title: "Public Case Study",
			description: "A publicly available case study",
			content: "Detailed case study content",
			type: "reference",
			published: true,
			published_date: "2024-01-01T00:00:00Z",
		});
	}),

	// Team Member Management endpoints
	http.get(`${API_BASE_URL}/api/team-members/`, () =>
		HttpResponse.json(mockTeamMembers)
	),

	http.get(`${API_BASE_URL}/api/team-members/:id/`, ({ params }) => {
		const memberId = Number.parseInt(params.id as string, 10);
		const member = mockTeamMembers.find((m) => m.id === memberId);

		if (!member) {
			return new HttpResponse(null, { status: 404 });
		}

		return HttpResponse.json(member);
	}),

	http.post(`${API_BASE_URL}/api/team-members/`, async ({ request }) => {
		const body = (await request.json()) as TeamMemberCreateRequest;
		const newMember = {
			id: Date.now(),
			name: body.name,
			title: body.title,
			department: body.department,
			email: body.email,
			role: body.isAdmin ? "Admin" : "Member",
			isAdmin: body.isAdmin,
			image: "https://via.placeholder.com/44", // Default placeholder image
		};

		return HttpResponse.json(newMember, { status: 201 });
	}),

	http.put(
		`${API_BASE_URL}/api/team-members/:id/`,
		async ({ params, request }) => {
			const memberId = Number.parseInt(params.id as string, 10);
			const body = (await request.json()) as TeamMemberUpdateRequest;
			const existingMember = mockTeamMembers.find((m) => m.id === memberId);

			if (!existingMember) {
				return new HttpResponse(null, { status: 404 });
			}

			const updatedMember = {
				...existingMember,
				name: body.name,
				title: body.title,
				department: body.department,
				role: body.isAdmin ? "Admin" : "Member",
				isAdmin: body.isAdmin,
			};

			return HttpResponse.json(updatedMember);
		}
	),

	http.delete(`${API_BASE_URL}/api/team-members/:id/`, ({ params }) => {
		const memberId = Number.parseInt(params.id as string, 10);
		const member = mockTeamMembers.find((m) => m.id === memberId);

		if (!member) {
			return new HttpResponse(null, { status: 404 });
		}

		return new HttpResponse(null, { status: 204 });
	}),

	// Team Member role/permission updates
	http.patch(
		`${API_BASE_URL}/api/team-members/:id/role/`,
		async ({ params, request }) => {
			const memberId = Number.parseInt(params.id as string, 10);
			const body = (await request.json()) as { role: string; isAdmin: boolean };
			const existingMember = mockTeamMembers.find((m) => m.id === memberId);

			if (!existingMember) {
				return new HttpResponse(null, { status: 404 });
			}

			const updatedMember = {
				...existingMember,
				role: body.role,
				isAdmin: body.isAdmin,
			};

			return HttpResponse.json(updatedMember);
		}
	),

	// Team Member activation/deactivation
	http.patch(`${API_BASE_URL}/api/team-members/:id/activate/`, ({ params }) => {
		const memberId = Number.parseInt(params.id as string, 10);
		const member = mockTeamMembers.find((m) => m.id === memberId);

		if (!member) {
			return new HttpResponse(null, { status: 404 });
		}

		return HttpResponse.json({
			...member,
			status: "active",
		});
	}),

	http.patch(
		`${API_BASE_URL}/api/team-members/:id/deactivate/`,
		({ params }) => {
			const memberId = Number.parseInt(params.id as string, 10);
			const member = mockTeamMembers.find((m) => m.id === memberId);

			if (!member) {
				return new HttpResponse(null, { status: 404 });
			}

			return HttpResponse.json({
				...member,
				status: "inactive",
			});
		}
	),

	// Team Member validation endpoints (for testing form validation)
	http.post(
		`${API_BASE_URL}/api/team-members/validate-email/`,
		async ({ request }) => {
			const body = (await request.json()) as { email: string };
			const emailExists = mockTeamMembers.some((m) => m.email === body.email);

			if (emailExists) {
				return HttpResponse.json(
					{ error: "Email already in use" },
					{ status: 400 }
				);
			}

			return HttpResponse.json({ valid: true });
		}
	),

	// Bulk team member operations
	http.post(
		`${API_BASE_URL}/api/team-members/bulk-update/`,
		async ({ request }) => {
			const body = (await request.json()) as {
				memberIds: number[];
				updates: Partial<TeamMemberUpdateRequest>;
			};

			const updatedMembers = body.memberIds
				.map((id) => {
					const member = mockTeamMembers.find((m) => m.id === id);
					if (!member) {
						return null;
					}

					return {
						...member,
						...body.updates,
						role: body.updates.isAdmin ? "Admin" : member.role,
					};
				})
				.filter(Boolean);

			return HttpResponse.json(updatedMembers);
		}
	),

	// Team Member search/filter endpoints
	http.get(`${API_BASE_URL}/api/team-members/search/`, ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get("q");
		const department = url.searchParams.get("department");
		const role = url.searchParams.get("role");

		let filteredMembers = mockTeamMembers;

		if (query) {
			filteredMembers = filteredMembers.filter(
				(member) =>
					member.name.toLowerCase().includes(query.toLowerCase()) ||
					member.email.toLowerCase().includes(query.toLowerCase()) ||
					member.title.toLowerCase().includes(query.toLowerCase())
			);
		}

		if (department) {
			filteredMembers = filteredMembers.filter(
				(member) => member.department === department
			);
		}

		if (role) {
			filteredMembers = filteredMembers.filter(
				(member) => member.role === role
			);
		}

		return HttpResponse.json(filteredMembers);
	}),

	// Error scenarios for testing
	http.post(`${API_BASE_URL}/api/team-members/error-test/`, () =>
		HttpResponse.json(
			{ error: "Simulated server error for testing" },
			{ status: 500 }
		)
	),

	http.put(`${API_BASE_URL}/api/team-members/validation-error/`, () =>
		HttpResponse.json(
			{
				name: ["Name is required"],
				title: ["Title must be at least 2 characters"],
				email: ["Email is already in use"],
			},
			{ status: 400 }
		)
	),

	// Fallback for unhandled requests
	http.all("*", () => new HttpResponse(null, { status: 404 })),
];
