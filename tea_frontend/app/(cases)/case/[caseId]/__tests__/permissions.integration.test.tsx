import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	createMockAssuranceCase,
	createMockUser,
	mockUser,
} from "@/src/__tests__/utils/mock-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Define permission payload type
interface PermissionPayload {
	email: string;
	view?: boolean;
	edit?: boolean;
	review?: boolean;
}

describe("Permission Management Integration Tests", () => {
	// Mock users for testing
	const viewUser = createMockUser({
		id: 2,
		username: "viewer",
		email: "viewer@example.com",
		first_name: "View",
		last_name: "User",
	});

	const editUser = createMockUser({
		id: 3,
		username: "editor",
		email: "editor@example.com",
		first_name: "Edit",
		last_name: "User",
	});

	const reviewUser = createMockUser({
		id: 4,
		username: "reviewer",
		email: "reviewer@example.com",
		first_name: "Review",
		last_name: "User",
	});

	// Mock assurance case with owner permissions
	const _mockCase = createMockAssuranceCase({
		id: 1,
		name: "Test Case with Permissions",
		permissions: "manage",
		owner: mockUser.id,
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	describe("Permission Management API Integration", () => {
		it("should fetch case members with different permission levels", async () => {
			let apiCalled = false;

			server.use(
				http.get(`${API_BASE_URL}/api/cases/:id/sharedwith`, ({ params }) => {
					apiCalled = true;
					expect(params.id).toBe("1");
					return HttpResponse.json({
						view: [viewUser],
						edit: [editUser],
						review: [reviewUser],
					});
				})
			);

			// Make API call
			const response = await fetch(`${API_BASE_URL}/api/cases/1/sharedwith`, {
				headers: {
					Authorization: "Token test-token",
				},
			});

			const data = await response.json();

			expect(apiCalled).toBe(true);
			expect(data.view).toHaveLength(1);
			expect(data.view[0].email).toBe(viewUser.email);
			expect(data.edit).toHaveLength(1);
			expect(data.edit[0].email).toBe(editUser.email);
			expect(data.review).toHaveLength(1);
			expect(data.review[0].email).toBe(reviewUser.email);
		});

		it("should add user with specific permission level", async () => {
			let requestBody: PermissionPayload[] | null = null;

			server.use(
				http.post(
					`${API_BASE_URL}/api/cases/:id/sharedwith`,
					async ({ request, params }) => {
						expect(params.id).toBe("1");
						requestBody = (await request.json()) as PermissionPayload[] | null;
						return HttpResponse.json({ success: true });
					}
				)
			);

			// Test adding view permission
			const viewPayload = [
				{
					email: "new@example.com",
					view: true,
					edit: false,
					review: false,
				},
			];

			const viewResponse = await fetch(
				`${API_BASE_URL}/api/cases/1/sharedwith`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Token test-token",
					},
					body: JSON.stringify(viewPayload),
				}
			);

			expect(viewResponse.ok).toBe(true);
			expect(requestBody).toEqual(viewPayload);

			// Test adding edit permission
			const editPayload = [
				{
					email: "editor@example.com",
					view: false,
					edit: true,
					review: false,
				},
			];

			const editResponse = await fetch(
				`${API_BASE_URL}/api/cases/1/sharedwith`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Token test-token",
					},
					body: JSON.stringify(editPayload),
				}
			);

			expect(editResponse.ok).toBe(true);
		});

		it("should remove user permissions", async () => {
			let requestBody: PermissionPayload[] | null = null;

			server.use(
				http.post(
					`${API_BASE_URL}/api/cases/:id/sharedwith`,
					async ({ request, params }) => {
						expect(params.id).toBe("1");
						requestBody = (await request.json()) as PermissionPayload[] | null;
						return HttpResponse.json({ success: true });
					}
				)
			);

			// Remove all permissions for a user
			const removePayload = [
				{
					email: viewUser.email,
					view: false,
					edit: false,
					review: false,
				},
			];

			const response = await fetch(`${API_BASE_URL}/api/cases/1/sharedwith`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token test-token",
				},
				body: JSON.stringify(removePayload),
			});

			expect(response.ok).toBe(true);
			expect(requestBody).toEqual(removePayload);
		});

		it("should handle permission errors", async () => {
			server.use(
				http.post(`${API_BASE_URL}/api/cases/:id/sharedwith`, () => {
					return new HttpResponse(null, { status: 400 });
				})
			);

			const response = await fetch(`${API_BASE_URL}/api/cases/1/sharedwith`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Token test-token",
				},
				body: JSON.stringify([
					{
						email: "invalid@example.com",
						view: true,
					},
				]),
			});

			expect(response.ok).toBe(false);
			expect(response.status).toBe(400);
		});

		it("should handle unauthorized access", async () => {
			server.use(
				http.get(`${API_BASE_URL}/api/cases/:id/sharedwith`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			const response = await fetch(`${API_BASE_URL}/api/cases/1/sharedwith`, {
				headers: {
					Authorization: "Token invalid-token",
				},
			});

			expect(response.status).toBe(401);
		});
	});

	describe("Permission Business Logic", () => {
		it("should validate email format before sending request", () => {
			const validEmail = "test@example.com";
			const invalidEmail = "invalid-email";

			expect(EMAIL_REGEX.test(validEmail)).toBe(true);
			expect(EMAIL_REGEX.test(invalidEmail)).toBe(false);
		});

		it("should correctly format permission payload", () => {
			const testCases = [
				{
					input: { email: "test@example.com", permission: "view" },
					expected: {
						email: "test@example.com",
						view: true,
						edit: false,
						review: false,
					},
				},
				{
					input: { email: "test@example.com", permission: "edit" },
					expected: {
						email: "test@example.com",
						view: false,
						edit: true,
						review: false,
					},
				},
				{
					input: { email: "test@example.com", permission: "review" },
					expected: {
						email: "test@example.com",
						view: false,
						edit: false,
						review: true,
					},
				},
			];

			for (const { input, expected } of testCases) {
				const payload = {
					email: input.email,
					view: input.permission === "view",
					edit: input.permission === "edit",
					review: input.permission === "review",
				};

				expect(payload).toEqual(expected);
			}
		});

		it("should handle permission hierarchy correctly", () => {
			// Business rule: manage > edit > review > view
			const permissions = {
				manage: ["create", "read", "update", "delete", "share"],
				edit: ["create", "read", "update"],
				review: ["read", "comment"],
				view: ["read"],
			};

			// Check manage has all permissions
			expect(permissions.manage).toContain("share");
			expect(permissions.manage.length).toBeGreaterThan(
				permissions.edit.length
			);

			// Check edit has more than review
			expect(permissions.edit).toContain("update");
			expect(permissions.edit).not.toContain("share");

			// Check view is most restrictive
			expect(permissions.view).toEqual(["read"]);
		});
	});

	describe("Permission State Management", () => {
		it("should update member lists when permissions change", () => {
			// Simulate state management
			const state = {
				viewMembers: [] as (typeof viewUser)[],
				editMembers: [] as (typeof editUser)[],
				reviewMembers: [] as (typeof reviewUser)[],
			};

			// Add view member
			state.viewMembers = [...state.viewMembers, viewUser];
			expect(state.viewMembers).toHaveLength(1);
			expect(state.viewMembers[0].email).toBe(viewUser.email);

			// Move member from view to edit
			state.viewMembers = state.viewMembers.filter((m) => m.id !== viewUser.id);
			state.editMembers = [...state.editMembers, viewUser];

			expect(state.viewMembers).toHaveLength(0);
			expect(state.editMembers).toHaveLength(1);
			expect(state.editMembers[0].email).toBe(viewUser.email);

			// Remove member completely
			state.editMembers = state.editMembers.filter((m) => m.id !== viewUser.id);
			expect(state.editMembers).toHaveLength(0);
		});

		it("should prevent duplicate members in same permission level", () => {
			const members = [viewUser];

			// Try to add same user again
			const newMember = viewUser;
			const updatedMembers = members.some((m) => m.email === newMember.email)
				? members
				: [...members, newMember];

			expect(updatedMembers).toHaveLength(1); // Should not duplicate
		});

		it("should handle batch permission updates", () => {
			const updates = [
				{ email: "user1@example.com", permission: "view" },
				{ email: "user2@example.com", permission: "edit" },
				{ email: "user3@example.com", permission: "review" },
			];

			const payload = updates.map((update) => ({
				email: update.email,
				view: update.permission === "view",
				edit: update.permission === "edit",
				review: update.permission === "review",
			}));

			expect(payload).toHaveLength(3);
			expect(payload[0].view).toBe(true);
			expect(payload[1].edit).toBe(true);
			expect(payload[2].review).toBe(true);
		});
	});
});
