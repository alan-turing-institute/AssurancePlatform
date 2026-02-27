import prisma from "@/lib/prisma";
import type {
	AssuranceCase,
	AssuranceElement,
	CasePermission,
	CaseStudy,
	CaseTeamPermission,
	Comment,
	Team,
	TeamMember,
	User,
} from "@/src/generated/prisma";

let counter = 0;

function nextId(): number {
	return ++counter;
}

/** Reset the counter — call in beforeEach if needed for deterministic IDs */
export function resetCounter(): void {
	counter = 0;
}

// ============================================
// USER
// ============================================

type UserOverrides = Partial<{
	email: string;
	username: string;
	passwordHash: string;
	passwordAlgorithm: string;
	authProvider: "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM";
	firstName: string;
	lastName: string;
	emailVerified: boolean;
}>;

export async function createTestUser(overrides: UserOverrides = {}): Promise<User> {
	const n = nextId();
	return prisma.user.create({
		data: {
			email: overrides.email ?? `test-${n}@example.com`,
			username: overrides.username ?? `testuser-${n}`,
			passwordHash: overrides.passwordHash ?? "not-a-real-hash",
			passwordAlgorithm: overrides.passwordAlgorithm ?? "argon2id",
			authProvider: overrides.authProvider ?? "LOCAL",
			firstName: overrides.firstName,
			lastName: overrides.lastName,
			emailVerified: overrides.emailVerified ?? false,
		},
	});
}

// ============================================
// TEAM
// ============================================

type TeamOverrides = Partial<{
	name: string;
	slug: string;
	description: string;
}>;

export async function createTestTeam(
	createdById: string,
	overrides: TeamOverrides = {}
): Promise<Team & { members: TeamMember[] }> {
	const n = nextId();
	return prisma.team.create({
		data: {
			name: overrides.name ?? `Test Team ${n}`,
			slug: overrides.slug ?? `test-team-${n}`,
			description: overrides.description,
			createdById,
			members: {
				create: {
					userId: createdById,
					role: "OWNER",
				},
			},
		},
		include: { members: true },
	});
}

export async function addTeamMember(
	teamId: string,
	userId: string,
	role: "ADMIN" | "MEMBER" = "MEMBER",
	invitedById?: string
): Promise<TeamMember> {
	return prisma.teamMember.create({
		data: {
			teamId,
			userId,
			role,
			invitedById,
		},
	});
}

// ============================================
// ASSURANCE CASE
// ============================================

type CaseOverrides = Partial<{
	name: string;
	description: string;
	mode: "STANDARD" | "ADVANCED";
	publishStatus: "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";
	published: boolean;
	isDemo: boolean;
}>;

export async function createTestCase(
	createdById: string,
	overrides: CaseOverrides = {}
): Promise<AssuranceCase> {
	const n = nextId();
	return prisma.assuranceCase.create({
		data: {
			name: overrides.name ?? `Test Case ${n}`,
			description: overrides.description ?? `Description for test case ${n}`,
			createdById,
			mode: overrides.mode ?? "STANDARD",
			publishStatus: overrides.publishStatus ?? "DRAFT",
			published: overrides.published ?? false,
			isDemo: overrides.isDemo ?? false,
		},
	});
}

// ============================================
// ASSURANCE ELEMENT
// ============================================

type ElementOverrides = Partial<{
	elementType:
		| "GOAL"
		| "CONTEXT"
		| "STRATEGY"
		| "PROPERTY_CLAIM"
		| "EVIDENCE"
		| "JUSTIFICATION"
		| "ASSUMPTION"
		| "MODULE"
		| "AWAY_GOAL"
		| "CONTRACT";
	name: string;
	description: string;
	parentId: string;
	role: "TOP_LEVEL" | "SUPPORTING";
	url: string;
	inSandbox: boolean;
}>;

export async function createTestElement(
	caseId: string,
	createdById: string,
	overrides: ElementOverrides = {}
): Promise<AssuranceElement> {
	const n = nextId();
	return prisma.assuranceElement.create({
		data: {
			caseId,
			createdById,
			elementType: overrides.elementType ?? "GOAL",
			name: overrides.name ?? `Element ${n}`,
			description: overrides.description ?? `Description for element ${n}`,
			parentId: overrides.parentId,
			role: overrides.role,
			url: overrides.url,
			inSandbox: overrides.inSandbox ?? false,
		},
	});
}

// ============================================
// CASE PERMISSION (user-level)
// ============================================

type PermissionLevel = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";

export async function createTestPermission(
	caseId: string,
	userId: string,
	grantedById: string,
	permission: PermissionLevel = "VIEW"
): Promise<CasePermission> {
	return prisma.casePermission.create({
		data: {
			caseId,
			userId,
			grantedById,
			permission,
		},
	});
}

// ============================================
// CASE TEAM PERMISSION
// ============================================

export async function createTestTeamPermission(
	caseId: string,
	teamId: string,
	grantedById: string,
	permission: PermissionLevel = "VIEW"
): Promise<CaseTeamPermission> {
	return prisma.caseTeamPermission.create({
		data: {
			caseId,
			teamId,
			grantedById,
			permission,
		},
	});
}

// ============================================
// COMMENT
// ============================================

type CommentOverrides = Partial<{
	caseId: string;
	elementId: string;
	content: string;
	parentCommentId: string;
}>;

export async function createTestComment(
	authorId: string,
	overrides: CommentOverrides = {}
): Promise<Comment> {
	const n = nextId();
	return prisma.comment.create({
		data: {
			authorId,
			content: overrides.content ?? `Test comment ${n}`,
			caseId: overrides.caseId,
			elementId: overrides.elementId,
			parentCommentId: overrides.parentCommentId,
		},
	});
}

// ============================================
// CASE STUDY
// ============================================

type CaseStudyOverrides = Partial<{
	title: string;
	description: string;
	authors: string;
	category: string;
	sector: string;
	published: boolean;
}>;

export async function createTestCaseStudy(
	ownerId: string,
	overrides: CaseStudyOverrides = {}
): Promise<CaseStudy> {
	const n = nextId();
	const now = new Date();
	const published = overrides.published ?? false;
	return prisma.caseStudy.create({
		data: {
			title: overrides.title ?? `Test Case Study ${n}`,
			description: overrides.description ?? null,
			authors: overrides.authors ?? null,
			category: overrides.category ?? null,
			sector: overrides.sector ?? null,
			published,
			publishedDate: published ? now : null,
			ownerId,
			createdOn: now,
			lastModifiedOn: now,
		},
	});
}
