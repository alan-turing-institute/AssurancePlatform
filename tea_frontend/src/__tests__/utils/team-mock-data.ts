// Mock data for team management tests

export type TeamMember = {
	id: number;
	name: string;
	title: string;
	department: string;
	email: string;
	role: string;
	isAdmin: boolean;
	image: string;
};

export const mockTeamMember: TeamMember = {
	id: 1,
	name: "Rich Griffiths",
	title: "Full Stack Developer",
	department: "Technology",
	email: "rich.griffiths89@gmail.com",
	role: "Admin",
	isAdmin: true,
	image: "https://res.cloudinary.com/dfs5xyvsv/image/upload/v1688998317/self_port-0142_edited_p5jqqw.jpg",
};

export const mockTeamMembers: TeamMember[] = [
	{
		id: 1,
		name: "Rich Griffiths",
		title: "Full Stack Developer",
		department: "Technology",
		email: "rich.griffiths89@gmail.com",
		role: "Admin",
		isAdmin: true,
		image: "https://res.cloudinary.com/dfs5xyvsv/image/upload/v1688998317/self_port-0142_edited_p5jqqw.jpg",
	},
	{
		id: 2,
		name: "Marlon Dedakis",
		title: "Developer",
		department: "Technology",
		email: "marlonscloud@gmail.com",
		role: "Member",
		isAdmin: false,
		image: "https://ca.slack-edge.com/E03KWED6CG5-U06MEU0UZSP-ecd95213a9c0-512",
	},
	{
		id: 3,
		name: "Kalle Westerling",
		title: "SCRUM Master",
		department: "Optimization",
		email: "kwesterling@turing.ac.uk",
		role: "Member",
		isAdmin: false,
		image: "https://ca.slack-edge.com/E03KWED6CG5-U030YSVFWEP-d243db60062e-512",
	},
	{
		id: 4,
		name: "Christopher Burr",
		title: "Project Manager",
		department: "Projects",
		email: "cburr@turing.ac.uk",
		role: "Member",
		isAdmin: false,
		image: "https://ca.slack-edge.com/E03KWED6CG5-U03KXHCSEHH-3e6c9201c305-512",
	},
];

// Factory function for creating test team members
export const createMockTeamMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
	...mockTeamMember,
	...overrides,
});

// Test data for different scenarios
export const adminMember: TeamMember = createMockTeamMember({
	id: 1,
	name: "Admin User",
	title: "Team Lead",
	department: "Technology",
	email: "admin@example.com",
	role: "Admin",
	isAdmin: true,
});

export const regularMember: TeamMember = createMockTeamMember({
	id: 2,
	name: "Regular User",
	title: "Developer",
	department: "Technology",
	email: "user@example.com",
	role: "Member",
	isAdmin: false,
});

export const hrMember: TeamMember = createMockTeamMember({
	id: 3,
	name: "HR Manager",
	title: "HR Manager",
	department: "HR",
	email: "hr@example.com",
	role: "Member",
	isAdmin: false,
});

export const corporateMember: TeamMember = createMockTeamMember({
	id: 4,
	name: "Corporate Lead",
	title: "Corporate Manager",
	department: "Corporate",
	email: "corporate@example.com",
	role: "Member",
	isAdmin: false,
});

export const optimizationMember: TeamMember = createMockTeamMember({
	id: 5,
	name: "Optimization Specialist",
	title: "Optimization Engineer",
	department: "Optimization",
	email: "optimization@example.com",
	role: "Member",
	isAdmin: false,
});

export const projectsMember: TeamMember = createMockTeamMember({
	id: 6,
	name: "Project Manager",
	title: "Senior Project Manager",
	department: "Projects",
	email: "projects@example.com",
	role: "Member",
	isAdmin: false,
});

// Department list for form validation tests
export const departments = [
	"Technology",
	"HR",
	"Corporate",
	"Optimization",
	"Projects",
];

// Mock team data
export const mockTeam = {
	id: 1,
	name: "Engineering Team",
	description: "Core engineering team",
	owner: 1,
	members: mockTeamMembers,
	created_date: "2024-01-01T00:00:00Z",
};

// Helper function to create arrays of mock team members
export const createMockTeamMemberArray = (
	factory: (index: number) => TeamMember,
	count: number
): TeamMember[] => {
	return Array.from({ length: count }, (_, index) => factory(index));
};

// Edge case data for testing
export const memberWithLongName: TeamMember = createMockTeamMember({
	id: 100,
	name: "A".repeat(100), // Very long name
	title: "B".repeat(100), // Very long title
	email: "verylongemail@example.com",
});

export const memberWithSpecialCharacters: TeamMember = createMockTeamMember({
	id: 101,
	name: "João Silva-O'Connor",
	title: "Senior Engineer & Team Lead",
	email: "joão.silva+test@example.com",
});

export const memberWithMinimalData: TeamMember = createMockTeamMember({
	id: 102,
	name: "AB", // Minimum valid name
	title: "CD", // Minimum valid title
	email: "a@b.co",
});
