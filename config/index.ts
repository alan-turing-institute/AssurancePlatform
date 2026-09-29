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

/**
 * The settings strip (`SettingsNav`). Hrefs corrected from `/settings/*` to
 * `/dashboard/settings/*` (TEA — Plugin management surface D1 — every link
 * in this strip 404'd before this fix). Notifications and Billing are
 * removed rather than corrected: no page exists for either under
 * `app/(authenticated)/dashboard/settings/`, so a working href would still
 * 404 (design amendment 2026-09-22) — re-add when a page exists. The
 * `current` field is dropped: `SettingsNav` derives the active item from
 * `usePathname()`, not from this list.
 */
export const settingsNavigation = [
	{ name: "Account", href: "/dashboard/settings" },
	{ name: "Teams", href: "/dashboard/settings/teams" },
	{ name: "Integrations", href: "/dashboard/settings/integrations" },
	{ name: "Plugins", href: "/dashboard/settings/plugins" },
];
