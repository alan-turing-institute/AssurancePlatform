// Mock data generators for tests
import type { AssuranceCase, CaseStudy } from "@/types/domain";

export const mockUser = {
	id: 1,
	username: "testuser",
	email: "test@example.com",
	first_name: "Test",
	last_name: "User",
	auth_provider: "github",
	auth_username: "testuser",
};

export const mockAssuranceCase = {
	id: 1,
	type: "AssuranceCase",
	name: "Test Assurance Case",
	description: "A comprehensive test case for testing purposes",
	created_date: "2024-01-01T00:00:00Z",
	lock_uuid: null,
	owner: mockUser.id,
	view_groups: [],
	edit_groups: [],
	review_groups: [],
	color_profile: "default",
	published: false,
	published_date: null,
	permissions: "manage" as const,
	comments: [],
	goals: [],
	property_claims: [],
	evidence: [],
	contexts: [],
	strategies: [],
	images: [],
	viewMembers: [],
	editMembers: [],
	reviewMembers: [],
};

export const mockGoal = {
	id: 1,
	name: "Primary Safety Goal",
	short_description: "Ensure system safety",
	long_description:
		"The system shall operate safely under all specified conditions",
	keywords: "safety, reliability",
	assurance_case: 1,
	assumption: null,
};

export const mockPropertyClaim = {
	id: 1,
	name: "Performance Claim",
	short_description: "System meets performance requirements",
	long_description: "The system shall respond within 100ms",
	property_claim_type: "performance",
	level: 1,
	claim_type: "claim",
	goal: 1,
	strategy: null,
	assurance_case: 1,
};

export const mockEvidence = {
	id: 1,
	name: "Test Results",
	short_description: "Automated test suite results",
	long_description: "Comprehensive test results showing 99.9% pass rate",
	URL: "https://example.com/test-results",
	assurance_case: 1,
};

export const mockContext = {
	id: 1,
	name: "Operating Environment",
	short_description: "System operating context",
	long_description: "The system operates in a controlled environment",
	goal: 1,
	assurance_case: 1,
};

export const mockStrategy = {
	id: 1,
	name: "Testing Strategy",
	short_description: "Comprehensive testing approach",
	long_description:
		"Multi-layered testing strategy including unit, integration, and E2E tests",
	goal: 1,
	assurance_case: 1,
};

export const mockComment = {
	id: 1,
	content: "This looks good to me",
	author: mockUser.id,
	author_name: `${mockUser.first_name} ${mockUser.last_name}`,
	created_date: "2024-01-01T10:00:00Z",
	assurance_case: 1,
	goal: null,
	property_claim: null,
	evidence: null,
	context: null,
	strategy: null,
};

export const mockCaseStudy = {
	id: 1,
	title: "Sample Case Study",
	description: "A comprehensive case study for learning",
	content: "Detailed case study content...",
	type: "learning",
	owner: mockUser.id,
	created_date: "2024-01-01T00:00:00Z",
	image: null,
};

export const mockPublishedCase = {
	id: 1,
	name: "Published Safety Case",
	description: "A published assurance case for public viewing",
	published_date: "2024-01-01T00:00:00Z",
	case_study: mockCaseStudy.id,
};

// Factory functions for creating multiple instances
export const createMockUser = (overrides: Partial<typeof mockUser> = {}) => ({
	...mockUser,
	...overrides,
});

export const createMockAssuranceCase = (
	overrides: Partial<AssuranceCase> = {}
): AssuranceCase =>
	({
		...mockAssuranceCase,
		...overrides,
	}) as AssuranceCase;

export const createMockGoal = (overrides: Partial<typeof mockGoal> = {}) => ({
	...mockGoal,
	...overrides,
});

export const createMockPropertyClaim = (
	overrides: Partial<typeof mockPropertyClaim> = {}
) => ({
	...mockPropertyClaim,
	...overrides,
});

export const createMockEvidence = (
	overrides: Partial<typeof mockEvidence> = {}
) => ({
	...mockEvidence,
	...overrides,
});

export const createMockContext = (
	overrides: Partial<typeof mockContext> = {}
) => ({
	...mockContext,
	...overrides,
});

export const createMockStrategy = (
	overrides: Partial<typeof mockStrategy> = {}
) => ({
	...mockStrategy,
	...overrides,
});

export const createMockComment = (
	overrides: Partial<typeof mockComment> = {}
) => ({
	...mockComment,
	...overrides,
});

export const createMockCaseStudy = (
	overrides: Partial<CaseStudy> = {}
): CaseStudy =>
	({
		...mockCaseStudy,
		...overrides,
	}) as CaseStudy;

// Mock team data
export const mockTeam = {
	id: 1,
	name: "Engineering Team",
	description: "Core engineering team",
	owner: mockUser.id,
	members: [mockUser.id],
	created_date: "2024-01-01T00:00:00Z",
};

export const createMockTeam = (overrides: Partial<typeof mockTeam> = {}) => ({
	...mockTeam,
	...overrides,
});

// Mock invitation data
export const mockInvitation = {
	id: 1,
	team: mockTeam.id,
	team_name: mockTeam.name,
	inviter: mockUser.id,
	inviter_name: `${mockUser.first_name} ${mockUser.last_name}`,
	invitee_email: "newmember@example.com",
	status: "pending" as const,
	created_date: "2024-01-01T00:00:00Z",
	expires_at: "2024-01-08T00:00:00Z",
};

export const createMockInvitation = (
	overrides: Partial<typeof mockInvitation> = {}
) => ({
	...mockInvitation,
	...overrides,
});

// Mock permission data
export const mockCasePermission = {
	id: 1,
	case: 1,
	user: 2,
	user_name: "Test Collaborator",
	permission_type: "view" as const,
	created_date: "2024-01-01T00:00:00Z",
};

export const createMockCasePermission = (
	overrides: Partial<typeof mockCasePermission> = {}
) => ({
	...mockCasePermission,
	...overrides,
});

// Helper to create arrays of mock data
export const createMockArray = <T>(
	factory: (index: number) => T,
	count: number
): T[] => {
	return Array.from({ length: count }, (_, index) => factory(index));
};

// Mock session data for NextAuth
export const mockSession = {
	user: {
		id: "1",
		name: "Test User",
		email: "test@example.com",
		image: null,
	},
	expires: "2025-12-31",
};

export const mockUnauthenticatedSession = {
	user: null,
	expires: null,
};
