import {
	DocumentDuplicateIcon,
	FolderIcon,
	GlobeAltIcon,
	TrashIcon,
	UserGroupIcon,
	UsersIcon,
} from "@heroicons/react/24/outline";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

export const navigation = [
	{
		name: "My Assurance Cases",
		href: "/dashboard",
		icon: FolderIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-my-cases",
	},
	{
		name: "Shared With Me",
		href: "/dashboard/shared",
		icon: UsersIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-shared",
	},
	{
		name: "Teams",
		href: "/dashboard/teams",
		icon: UserGroupIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-teams",
	},
	{
		name: "Trash",
		href: "/dashboard/trash",
		icon: TrashIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-trash",
	},
	{
		name: "Discover Public Projects",
		href: "/discover",
		icon: GlobeAltIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-discover",
	},
];

export const externalNavigation = [
	{
		name: "GitHub",
		href: "https://github.com/alan-turing-institute/AssurancePlatform",
		icon: GitHubLogoIcon,
		current: false,
		externalLink: true,
		tourId: "sidebar-github",
	},
	{
		name: "Documentation",
		href: "/docs",
		icon: DocumentDuplicateIcon,
		current: false,
		externalLink: false,
		tourId: "sidebar-docs",
	},
];

export const teams: Array<{
	id: number;
	name: string;
	href: string;
	initial: string;
	current: boolean;
}> = [];

export const userNavigation = [
	{ name: "Your profile", href: "#" },
	{ name: "Sign out", href: "#" },
];

/**
 * Department options for team member forms
 */
export const departments = [
	"Technology",
	"HR",
	"Corporate",
	"Optimisation",
	"Projects",
] as const;

export const settingsNavigation = [
	{ name: "Account", href: "/settings", current: true },
	{ name: "Notifications", href: "/settings/notifications", current: false },
	{ name: "Billing", href: "/settings/billing", current: false },
	{ name: "Teams", href: "/settings/teams", current: false },
	{ name: "Integrations", href: "/settings/integrations", current: false },
];
