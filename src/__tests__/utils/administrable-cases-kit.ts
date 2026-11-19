import prisma from "@/lib/prisma";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

/**
 * A world for the tests of who may administer a case: four people, seven
 * holders of shares (two people and five teams that reach the reader in
 * different ways) and a list of cases, each shared in one arrangement.
 */

export type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";
export type User = Awaited<ReturnType<typeof createTestUser>>;
export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";

export const LEVELS: Level[] = ["VIEW", "COMMENT", "EDIT", "ADMIN"];

/** The people in the world. The reader is the one whose lists are read. */
export type PersonKey = "reader" | "other" | "creator" | "stranger";
export const PERSON_KEYS: PersonKey[] = [
	"reader",
	"other",
	"creator",
	"stranger",
];

/** Who or what a case can be shared with. */
export type Holder =
	| "reader"
	| "other"
	| "memberTeam"
	| "adminRoleTeam"
	| "ownerRoleTeam"
	| "outsideTeam"
	| "formerTeam";

/** What each person holds, directly or by belonging to a team. */
const HELD_BY: Record<PersonKey, Holder[]> = {
	reader: ["reader", "memberTeam", "adminRoleTeam", "ownerRoleTeam"],
	other: ["other", "outsideTeam", "formerTeam"],
	creator: [],
	stranger: [],
};

export interface ShareSpec {
	level: Level;
	to: Holder;
}

export interface CaseSpec {
	creator: PersonKey;
	kind?: "CASE" | "PATTERN";
	name: string;
	shares: ShareSpec[];
	trashed?: boolean;
}

function share(to: Holder, level: Level): ShareSpec {
	return { to, level };
}

function spec(
	name: string,
	creator: PersonKey,
	shares: ShareSpec[],
	extra: Pick<CaseSpec, "kind" | "trashed"> = {}
): CaseSpec {
	return { name, creator, shares, ...extra };
}

const BY_LEVEL: CaseSpec[] = LEVELS.flatMap((level) => [
	spec(`shared directly at ${level}`, "creator", [share("reader", level)]),
	spec(`shared to a team at ${level}`, "creator", [share("memberTeam", level)]),
]);

const BY_TEAM_ROLE: CaseSpec[] = [
	spec("team admin role at ADMIN", "creator", [
		share("adminRoleTeam", "ADMIN"),
	]),
	spec("team owner role at ADMIN", "creator", [
		share("ownerRoleTeam", "ADMIN"),
	]),
	spec("team admin role at EDIT", "creator", [share("adminRoleTeam", "EDIT")]),
	spec("team owner role at EDIT", "creator", [share("ownerRoleTeam", "EDIT")]),
];

const TWO_WAYS: CaseSpec[] = [
	spec("direct VIEW and team ADMIN", "creator", [
		share("reader", "VIEW"),
		share("memberTeam", "ADMIN"),
	]),
	spec("direct ADMIN and team VIEW", "creator", [
		share("reader", "ADMIN"),
		share("memberTeam", "VIEW"),
	]),
	spec("direct EDIT and team EDIT", "creator", [
		share("reader", "EDIT"),
		share("memberTeam", "EDIT"),
	]),
	spec("direct ADMIN and team ADMIN", "creator", [
		share("reader", "ADMIN"),
		share("memberTeam", "ADMIN"),
	]),
	spec("two teams at ADMIN", "creator", [
		share("memberTeam", "ADMIN"),
		share("adminRoleTeam", "ADMIN"),
	]),
	spec("own case also shared to the reader at VIEW", "reader", [
		share("reader", "VIEW"),
	]),
];

const OTHER_PEOPLE: CaseSpec[] = [
	spec("reader VIEW and another person ADMIN", "creator", [
		share("reader", "VIEW"),
		share("other", "ADMIN"),
	]),
	spec("team VIEW and a team ADMIN the reader is outside", "creator", [
		share("memberTeam", "VIEW"),
		share("outsideTeam", "ADMIN"),
	]),
	spec("team ADMIN the reader left", "creator", [share("formerTeam", "ADMIN")]),
	spec("team ADMIN the reader is outside", "creator", [
		share("outsideTeam", "ADMIN"),
	]),
	spec("not shared", "creator", []),
];

const KINDS_AND_TRASH: CaseSpec[] = [
	spec("own case", "reader", []),
	spec("own trashed case", "reader", [], { trashed: true }),
	spec("own pattern", "reader", [], { kind: "PATTERN" }),
	spec(
		"trashed, shared directly at ADMIN",
		"creator",
		[share("reader", "ADMIN")],
		{ trashed: true }
	),
	spec(
		"trashed, shared to a team at ADMIN",
		"creator",
		[share("memberTeam", "ADMIN")],
		{ trashed: true }
	),
	spec(
		"pattern shared directly at ADMIN",
		"creator",
		[share("reader", "ADMIN")],
		{ kind: "PATTERN" }
	),
	spec(
		"pattern shared to a team at ADMIN",
		"creator",
		[share("memberTeam", "ADMIN")],
		{ kind: "PATTERN" }
	),
];

const CASE_SPECS: CaseSpec[] = [
	...BY_LEVEL,
	...BY_TEAM_ROLE,
	...TWO_WAYS,
	...OTHER_PEOPLE,
	...KINDS_AND_TRASH,
];

/**
 * Whether the person can administer the case, from the plain statement of the
 * rule and not from the code under test: made it, or was given ADMIN directly
 * or through a team they belong to, and the case is not in the trash. The kind
 * of the case does not matter here.
 */
export function canAdminister(person: PersonKey, theCase: CaseSpec): boolean {
	if (theCase.trashed) {
		return false;
	}
	if (theCase.creator === person) {
		return true;
	}
	return theCase.shares.some(
		(held) => held.level === "ADMIN" && HELD_BY[person].includes(held.to)
	);
}

/** Whether the grant form should list the case for the person. */
export function shouldList(person: PersonKey, theCase: CaseSpec): boolean {
	return theCase.kind !== "PATTERN" && canAdminister(person, theCase);
}

/** A team in which the user holds the given role. */
export async function teamWithRole(userId: string, role: TeamRole) {
	if (role === "OWNER") {
		return await createTestTeam(userId);
	}
	const lead = await createTestUser();
	const team = await createTestTeam(lead.id);
	await addTeamMember(team.id, userId, role);
	return team;
}

interface HolderRef {
	id: string;
	kind: "user" | "team";
}

async function buildPeople() {
	const people = {
		reader: await createTestUser(),
		other: await createTestUser(),
		creator: await createTestUser(),
		stranger: await createTestUser(),
	};
	return people satisfies Record<PersonKey, User>;
}

async function buildHolders(people: Record<PersonKey, User>) {
	const { reader, other } = people;
	const outside = await createTestTeam(other.id);
	const former = await createTestTeam(other.id);
	const membership = await addTeamMember(former.id, reader.id, "MEMBER");
	await prisma.teamMember.delete({ where: { id: membership.id } });
	const holders: Record<Holder, HolderRef> = {
		reader: { kind: "user", id: reader.id },
		other: { kind: "user", id: other.id },
		memberTeam: {
			kind: "team",
			id: (await teamWithRole(reader.id, "MEMBER")).id,
		},
		adminRoleTeam: {
			kind: "team",
			id: (await teamWithRole(reader.id, "ADMIN")).id,
		},
		ownerRoleTeam: {
			kind: "team",
			id: (await teamWithRole(reader.id, "OWNER")).id,
		},
		outsideTeam: { kind: "team", id: outside.id },
		formerTeam: { kind: "team", id: former.id },
	};
	return holders;
}

function shareWith(
	caseId: string,
	holder: HolderRef,
	level: Level,
	grantedById: string
) {
	return holder.kind === "user"
		? createTestPermission(caseId, holder.id, grantedById, level)
		: createTestTeamPermission(caseId, holder.id, grantedById, level);
}

interface MadeCase {
	id: string;
	spec: CaseSpec;
}

async function buildCase(
	theCase: CaseSpec,
	people: Record<PersonKey, User>,
	holders: Record<Holder, HolderRef>
): Promise<MadeCase> {
	const creator = people[theCase.creator];
	const made = await createTestCase(creator.id, {
		name: theCase.name,
		kind: theCase.kind ?? "CASE",
	});
	if (theCase.trashed) {
		await prisma.assuranceCase.update({
			where: { id: made.id },
			data: { deletedAt: new Date(), deletedById: creator.id },
		});
	}
	for (const held of theCase.shares) {
		await shareWith(made.id, holders[held.to], held.level, creator.id);
	}
	return { id: made.id, spec: theCase };
}

/** Everything is created fresh, so build the world once in each test. */
export async function buildWorld(specs: CaseSpec[] = CASE_SPECS) {
	const people = await buildPeople();
	const holders = await buildHolders(people);
	const cases: MadeCase[] = [];
	for (const theCase of specs) {
		cases.push(await buildCase(theCase, people, holders));
	}
	return { people, holders, cases };
}

export type World = Awaited<ReturnType<typeof buildWorld>>;
