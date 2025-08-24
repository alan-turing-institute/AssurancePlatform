import { act, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { renderWithAuth } from "./test-utils";

type ModalStore = {
	isOpen: boolean;
	onOpen: () => void;
	onClose: () => void;
};

// Mock modal stores
export const mockModalStores = {
	permissions: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
	share: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
	caseCreate: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
	import: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
	email: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
	resources: {
		isOpen: false,
		onOpen: vi.fn(),
		onClose: vi.fn(),
	},
};

// Helper to open a modal in tests
export const openModal = (modalStore: ModalStore) => {
	act(() => {
		modalStore.isOpen = true;
		modalStore.onOpen();
	});
};

// Helper to close a modal in tests
export const closeModal = (modalStore: ModalStore) => {
	act(() => {
		modalStore.isOpen = false;
		modalStore.onClose();
	});
};

// Helper to render with modal provider
export const renderWithModal = (
	ui: ReactElement,
	_modalStore: ModalStore = mockModalStores.permissions
) => {
	// Mock the specific modal hook
	vi.mock("@/hooks/use-permissions-modal", () => ({
		usePermissionsModal: () => mockModalStores.permissions,
	}));

	return renderWithAuth(ui);
};

// Helper to wait for modal to appear
export const waitForModal = async (testId: string) => {
	return await screen.findByTestId(testId);
};

// Reset all modal mocks
export const resetModalMocks = () => {
	for (const store of Object.values(mockModalStores)) {
		store.isOpen = false;
		store.onOpen.mockClear();
		store.onClose.mockClear();
	}
};

// Export from testing library for convenience
export { screen, waitFor } from "@testing-library/react";
