// Mock data generators for tests
import type {
	AssuranceCaseResponse,
	CaseStudyResponse,
} from "@/lib/services/case-response-types";
import type { CommentResponse } from "@/lib/services/comment-service";

export const mockUser = {
	id: 1,
	username: "testuser",
	email: "test@example.com",
	first_name: "Test",
	last_name: "User",
	auth_provider: "github",
	auth_username: "testuser",
};

export const mockAssuranceCase: AssuranceCaseResponse = {
	id: "1",
	type: "AssuranceCase",
	name: "Test Assurance Case",
	description: "A comprehensive test case for testing purposes",
	createdDate: "2024-01-01T00:00:00Z",
	owner: String(mockUser.id),
	colourProfile: "default",
	published: false,
	publishedAt: null,
	permissions: "manage",
	comments: [],
	goals: [],
	viewMembers: [],
	editMembers: [],
	reviewMembers: [],
	images: [],
};

export const mockGoal = {
	id: "1",
	name: "Primary Safety Goal",
	shortDescription: "Ensure system safety",
	longDescription:
		"The system shall operate safely under all specified conditions",
	keywords: "safety, reliability",
	assuranceCaseId: "1",
	assumption: null,
};

export const mockPropertyClaim = {
	id: "1",
	name: "Performance Claim",
	shortDescription: "System meets performance requirements",
	longDescription: "The system shall respond within 100ms",
	propertyClaimType: "performance",
	level: 1,
	claimType: "claim",
	goal: "1",
	strategy: null,
	assuranceCaseId: "1",
};

export const mockEvidence = {
	id: "1",
	name: "Test Results",
	shortDescription: "Automated test suite results",
	longDescription: "Comprehensive test results showing 99.9% pass rate",
	URL: "https://example.com/test-results",
	assuranceCaseId: "1",
};

export const mockContext = {
	id: "1",
	name: "Operating Environment",
	shortDescription: "System operating context",
	longDescription: "The system operates in a controlled environment",
	goal: "1",
	assuranceCaseId: "1",
};

export const mockStrategy = {
	id: "1",
	name: "Testing Strategy",
	shortDescription: "Comprehensive testing approach",
	longDescription:
		"Multi-layered testing strategy including unit, integration, and E2E tests",
	goal: "1",
	assuranceCaseId: "1",
};

export const mockComment: CommentResponse = {
	id: "1",
	content: "This looks good to me",
	author: `${mockUser.first_name} ${mockUser.last_name}`,
	authorId: String(mockUser.id),
	createdAt: "2024-01-01T10:00:00Z",
};

export const mockCaseStudy: CaseStudyResponse = {
	id: 1,
	title: "Sample Case Study",
	description: "A comprehensive case study for learning",
	sector: "learning",
	createdOn: "2024-01-01T00:00:00Z",
	authors: "Test User",
	published: false,
	featuredImage: undefined,
};

export const mockPublishedCase = {
	id: "1",
	name: "Published Safety Case",
	description: "A published assurance case for public viewing",
	publishedDate: "2024-01-01T00:00:00Z",
	caseStudy: mockCaseStudy.id,
};

// Factory functions for creating multiple instances
export const createMockUser = (overrides: Partial<typeof mockUser> = {}) => ({
	...mockUser,
	...overrides,
});

export const createMockAssuranceCase = (
	overrides: Partial<AssuranceCaseResponse> = {}
): AssuranceCaseResponse => ({
	...mockAssuranceCase,
	...overrides,
});

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
	overrides: Partial<CommentResponse> = {}
): CommentResponse => ({
	...mockComment,
	...overrides,
});

export const createMockCaseStudy = (
	overrides: Partial<CaseStudyResponse> = {}
): CaseStudyResponse => ({
	...mockCaseStudy,
	...overrides,
});

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
): T[] => Array.from({ length: count }, (_, index) => factory(index));

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
