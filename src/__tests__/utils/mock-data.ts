// Mock data generators for tests

export const mockUser = {
	id: 1,
	username: "testuser",
	email: "test@example.com",
	first_name: "Test",
	last_name: "User",
	auth_provider: "github",
	auth_username: "testuser",
};

// Mock team data
export const mockTeam = {
	id: 1,
	name: "Engineering Team",
	description: "Core engineering team",
	owner: mockUser.id,
	members: [mockUser.id],
	created_date: "2024-01-01T00:00:00Z",
};

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

// Mock permission data
export const mockCasePermission = {
	id: 1,
	case: 1,
	user: 2,
	user_name: "Test Collaborator",
	permission_type: "view" as const,
	created_date: "2024-01-01T00:00:00Z",
};
