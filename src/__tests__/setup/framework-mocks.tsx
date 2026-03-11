import type React from "react";
import { vi } from "vitest";
import {
	mockNotFound,
	mockUseParams,
	mockUsePathname,
	mockUseRouter,
	mockUseSearchParams,
} from "../mocks/next-navigation-mocks";

// Mock Next.js router
vi.mock("next/navigation", () => ({
	useRouter: mockUseRouter,
	usePathname: mockUsePathname,
	useSearchParams: mockUseSearchParams,
	useParams: mockUseParams,
	notFound: mockNotFound,
}));

// Mock Next.js image component
vi.mock("next/image", () => ({
	default: (props: {
		fill?: boolean;
		priority?: boolean;
		quality?: number;
		placeholder?: string;
		blurDataURL?: string;
		[key: string]: unknown;
	}) => {
		const {
			fill: _fill,
			priority: _priority,
			quality: _quality,
			placeholder: _placeholder,
			blurDataURL: _blurDataURL,
			...imgProps
		} = props;
		// biome-ignore lint/performance/noImgElement: Test mock replaces next/image
		// biome-ignore lint/correctness/useImageSize: Test mock does not need explicit dimensions
		return <img alt="" {...imgProps} />;
	},
}));

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
	useTheme: () => ({
		theme: "light",
		setTheme: vi.fn(),
		resolvedTheme: "light",
		themes: ["light", "dark", "system"],
		systemTheme: "light",
	}),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: {
				id: "1",
				name: "Test User",
				email: "test@example.com",
			},
			key: "mock-jwt-token",
			expires: "2025-12-31",
		},
		status: "authenticated",
	}),
	signIn: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock toast hook
vi.mock("@/lib/toast", () => ({
	useToast: () => ({
		toast: vi.fn(),
	}),
	toast: vi.fn(),
}));

// Mock all basic modal hooks to prevent modals from rendering in tests
const mockModalHook = () => ({
	isOpen: false,
	onOpen: vi.fn(),
	onClose: vi.fn(),
});

vi.mock("@/hooks/modal-hooks", () => ({
	useCreateCaseModal: mockModalHook,
	useCreateTeamModal: mockModalHook,
	useEmailModal: mockModalHook,
	useExportModal: mockModalHook,
	useImportModal: mockModalHook,
	usePermissionsModal: mockModalHook,
	useResourcesModal: mockModalHook,
}));

// Mock the entire ModalProvider to prevent modal rendering in tests
vi.mock("@/providers/modal-provider", () => ({
	ModalProvider: () => null,
}));
