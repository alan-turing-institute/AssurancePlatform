// Mock data for team management tests

export interface TeamMember {
	department: string;
	email: string;
	id: number;
	image: string;
	isAdmin: boolean;
	name: string;
	role: string;
	title: string;
}

export const mockTeamMembers: TeamMember[] = [
	{
		id: 1,
		name: "Rich Griffiths",
		title: "Full Stack Developer",
		department: "Technology",
		email: "rich.griffiths89@gmail.com",
		role: "Admin",
		isAdmin: true,
		image:
			"https://res.cloudinary.com/dfs5xyvsv/image/upload/v1688998317/self_port-0142_edited_p5jqqw.jpg",
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

// Mock team data
export const mockTeam = {
	id: 1,
	name: "Engineering Team",
	description: "Core engineering team",
	owner: 1,
	members: mockTeamMembers,
	created_date: "2024-01-01T00:00:00Z",
};
