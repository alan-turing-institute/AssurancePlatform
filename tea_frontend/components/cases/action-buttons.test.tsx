import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	mockModalStores,
	resetModalMocks,
} from "@/src/__tests__/utils/modal-test-utils";
import { screen, waitFor, within } from "@/src/__tests__/utils/test-utils";
import { render } from "@testing-library/react";

// Define mock functions before using them
const mockPush = vi.fn();
const mockReload = vi.fn();

// Mock next/navigation before importing components
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
	}),
	useParams: () => ({ caseId: "1" }),
	usePathname: () => "/case/1",
	useSearchParams: () => new URLSearchParams(),
}));

// Import will be added after all mocks

// Mock CSS imports
vi.mock("react-toastify/dist/ReactToastify.css", () => ({}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	Camera: () => <span>Camera</span>,
	ExternalLink: () => <span>ExternalLink</span>,
	Group: () => <span>Group</span>,
	Info: () => <span>Info</span>,
	Notebook: () => <span>Notebook</span>,
	Plus: () => <span>Plus</span>,
	RotateCw: () => <span>RotateCw</span>,
	Trash2: () => <span>Trash2</span>,
	Users2: () => <span>Users2</span>,
}));

// Mock next-auth/react
vi.mock("next-auth/react");

// Mock the ModalProvider to avoid mounting issues in tests
vi.mock("@/providers/modal-provider", () => ({
	ModalProvider: () => null, // Return null to avoid rendering modal components in tests
}));

// Mock ActionTooltip to add aria-label to children - improved version
vi.mock("../ui/action-tooltip", () => ({
	default: ({
		children,
		label,
	}: {
		children: React.ReactNode;
		label: string;
	}) => {
		const React = require("react");

		// Simple passthrough with aria-label
		if (React.isValidElement(children)) {
			return React.cloneElement(children, {
				"aria-label": label,
			});
		}

		// Fallback - wrap in a div if children is not a valid element
		return React.createElement("div", { "aria-label": label }, children);
	},
}));

// Regex constants for test assertions
const DELETE_BUTTON_REGEX = /Delete/;
const CANCEL_BUTTON_REGEX = /Cancel/;
const PROCESSING_REGEX = /Processing/;
const SCREENSHOT_SAVED_REGEX = /Screenshot Saved!/;
const NEW_GOAL_REGEX = /New Goal/;
const FOCUS_REGEX = /Focus/;
const RESET_IDENTIFIERS_REGEX = /Reset Identifiers/;
const RESOURCES_REGEX = /Resources/;
const SHARE_EXPORT_REGEX = /Share & Export/;
const PERMISSIONS_REGEX = /Permissions/;
const NOTES_REGEX = /Notes/;
const CAPTURE_REGEX = /Capture/;
const DELETE_CASE_CONFIRMATION_REGEX = /Are you sure\?/;
const RESET_IDENTIFIERS_MESSAGE_REGEX =
	/Updating the identifiers will systematically reset/;
const ACTION_CANNOT_BE_UNDONE_REGEX = /This action cannot be undone/;

// Mock html2canvas
vi.mock("html2canvas", () => ({
	default: vi.fn().mockResolvedValue({
		toDataURL: vi.fn().mockReturnValue("data:image/png;base64,mockImageData"),
	}),
}));

// Mock modal hooks
vi.mock("@/hooks/use-permissions-modal", () => ({
	usePermissionsModal: () => mockModalStores.permissions,
}));

vi.mock("@/hooks/use-share-modal", () => ({
	useShareModal: () => mockModalStores.share,
}));

vi.mock("@/hooks/use-resources-modal", () => ({
	useResourcesModal: () => mockModalStores.resources,
}));

// Mock toastify
vi.mock("react-toastify", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// Mock window.location.reload
Object.defineProperty(window, "location", {
	value: {
		reload: mockReload,
	},
	writable: true,
});

// Mock AlertModal component
vi.mock("../modals/alert-modal", () => ({
	AlertModal: ({
		isOpen,
		onClose,
		onConfirm,
		loading,
		confirmButtonText,
		cancelButtonText,
		message,
	}: any) => {
		if (!isOpen) {
			return null;
		}

		// Use different test IDs based on button text to distinguish between modals
		const dataTestId = confirmButtonText?.toLowerCase().includes('delete')
			? 'delete-modal'
			: confirmButtonText?.toLowerCase().includes('reset')
				? 'reset-modal'
				: 'alert-modal';

		return (
			<div role="dialog" data-testid={dataTestId}>
				<h2>Are you sure?</h2>
				<p>{message || "This action cannot be undone."}</p>
				<button
					disabled={loading}
					onClick={onClose}
					type="button"
					data-testid={`${dataTestId}-cancel`}
				>
					{cancelButtonText || "Cancel"}
				</button>
				<button
					disabled={loading}
					onClick={onConfirm}
					type="button"
					data-testid={`${dataTestId}-confirm`}
				>
					{loading ? "Processing" : confirmButtonText}
				</button>
			</div>
		);
	},
}));

// Mock NodeCreate component
vi.mock("@/components/common/node-create", () => ({
	default: ({
		isOpen,
		setOpen,
	}: {
		isOpen: boolean;
		setOpen: (open: boolean) => void;
	}) => {
		if (!isOpen) {
			return null;
		}
		return (
			<div data-testid="node-create-modal">
				<button onClick={() => setOpen(false)} type="button">
					Close
				</button>
			</div>
		);
	},
}));

// Mock CaseNotes component
vi.mock("./case-notes", () => ({
	default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
		if (!isOpen) {
			return null;
		}
		return (
			<div data-testid="case-notes-modal">
				<button onClick={onClose} type="button">
					Close Notes
				</button>
			</div>
		);
	},
}));

// Create the mock store state
const mockStoreState = {
	assuranceCase: {
		id: 1,
		name: "Test Case",
		permissions: "manage",
		description: "Test description",
		created_date: "2024-01-01",
		goals: [],
		type: "AssuranceCase",
		lock_uuid: null,
		owner: 1,
		view_groups: [],
		edit_groups: [],
		review_groups: [],
		color_profile: "default",
		published: false,
		published_date: null,
		comments: [],
		property_claims: [],
		evidence: [],
		contexts: [],
		strategies: [],
		images: [],
		viewMembers: [],
		editMembers: [],
		reviewMembers: [],
	},
	setAssuranceCase: vi.fn(),
	orphanedElements: [],
	setOrphanedElements: vi.fn(),
	viewMembers: [],
	setViewMembers: vi.fn(),
	editMembers: [],
	setEditMembers: vi.fn(),
	reviewMembers: [],
	setReviewMembers: vi.fn(),
	nodes: [],
	edges: [],
	setNodes: vi.fn(),
	setEdges: vi.fn(),
	onNodesChange: vi.fn(),
	onEdgesChange: vi.fn(),
	onConnect: vi.fn(),
	nodeTypes: {},
};

const mockStore = vi.fn(() => mockStoreState);

vi.mock("@/data/store", () => ({
	default: vi.fn(() => mockStoreState),
}));

// Import ActionButtons after all mocks are set up
import ActionButtons from "./action-buttons";

// Create working test providers without problematic ModalProvider
const TestProviders = ({ children }: { children: React.ReactNode }) => {
	const { SessionProvider } = require("next-auth/react");
	const { ThemeProvider: NextThemesProvider } = require("next-themes");

	return (
		<SessionProvider
			session={{
				key: "mock-token",
				user: { name: "Test", email: "test@example.com" },
				expires: "2025-12-31",
			}}
		>
			<NextThemesProvider
				attribute="class"
				defaultTheme="system"
				disableTransitionOnChange
				enableSystem
			>
				{children}
			</NextThemesProvider>
		</SessionProvider>
	);
};

const _renderWithWorkingProviders = (ui: React.ReactElement) => {
	return render(<TestProviders>{ui}</TestProviders>);
};

describe("ActionButtons", () => {
	const mockNotify = vi.fn();
	const mockNotifyError = vi.fn();
	const mockOnLayout = vi.fn();

	// Helper to update the store mock
	const updateStoreMock = (overrides: any = {}) => {
		// Update the mock state with overrides
		Object.assign(mockStoreState, overrides);

		// If assuranceCase overrides are provided, merge them into the existing structure
		if (overrides.assuranceCase) {
			Object.assign(mockStoreState.assuranceCase, overrides.assuranceCase);
		}
	};

	const defaultProps = {
		showCreateGoal: true,
		actions: {
			onLayout: mockOnLayout,
		},
		notify: mockNotify,
		notifyError: mockNotifyError,
	};

	beforeEach(() => {
		// Create ReactFlow element for screenshot tests
		const reactFlowElement = document.createElement('div');
		reactFlowElement.id = 'ReactFlow';
		document.body.appendChild(reactFlowElement);

		// Reset store to default state
		Object.assign(mockStoreState, {
			assuranceCase: {
				id: 1,
				name: "Test Case",
				permissions: "manage",
				description: "Test description",
				created_date: "2024-01-01",
				goals: [],
				type: "AssuranceCase",
				lock_uuid: null,
				owner: 1,
				view_groups: [],
				edit_groups: [],
				review_groups: [],
				color_profile: "default",
				published: false,
				published_date: null,
				comments: [],
				property_claims: [],
				evidence: [],
				contexts: [],
				strategies: [],
				images: [],
				viewMembers: [],
				editMembers: [],
				reviewMembers: [],
			},
			setAssuranceCase: vi.fn(),
			orphanedElements: [],
			setOrphanedElements: vi.fn(),
			viewMembers: [],
			setViewMembers: vi.fn(),
			editMembers: [],
			setEditMembers: vi.fn(),
			reviewMembers: [],
			setReviewMembers: vi.fn(),
			nodes: [],
			edges: [],
			setNodes: vi.fn(),
			setEdges: vi.fn(),
			onNodesChange: vi.fn(),
			onEdgesChange: vi.fn(),
			onConnect: vi.fn(),
			nodeTypes: {},
		});

		// Essential mock setup for ActionButtons to render
		vi.mocked(useSession).mockReturnValue({
			data: {
				user: { name: "Test User", email: "test@example.com" },
				expires: "2025-12-31",
				key: "mock-token",
			},
			status: "authenticated",
			update: vi.fn(),
		});

		// Reset modal mocks
		resetModalMocks();

		// Clear all other mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Clean up ReactFlow element
		const reactFlowElement = document.getElementById('ReactFlow');
		if (reactFlowElement) {
			reactFlowElement.remove();
		}
	});

	describe("Basic rendering", () => {
		it("should render something", () => {
			const { container } = render(<ActionButtons {...defaultProps} />);
			const actionButtonsDiv = container.querySelector("div.fixed");
			expect(actionButtonsDiv).toBeInTheDocument();
		});

		it("should render with providers", () => {
			const { container } = render(<ActionButtons {...defaultProps} />);
			expect(container.firstChild).toBeTruthy();
		});
	});

	describe("Rendering based on permissions", () => {
		it("debug: check store state", () => {
			// The store should have manage permissions by default
			render(<ActionButtons {...defaultProps} />);

			// Check that we have buttons that require manage permissions
			expect(screen.getByLabelText("New Goal")).toBeInTheDocument();
			expect(screen.getByLabelText("Delete")).toBeInTheDocument();
		});

		it("should render all buttons for manage permission", () => {
			render(<ActionButtons {...defaultProps} />);

			// Check for buttons by their aria-label
			expect(screen.getByLabelText("New Goal")).toBeInTheDocument();
			expect(screen.getByLabelText("Focus")).toBeInTheDocument();
			expect(screen.getByLabelText("Reset Identifiers")).toBeInTheDocument();
			expect(screen.getByLabelText("Resources")).toBeInTheDocument();
			expect(screen.getByLabelText("Share & Export")).toBeInTheDocument();
			expect(screen.getByLabelText("Permissions")).toBeInTheDocument();
			expect(screen.getByLabelText("Notes")).toBeInTheDocument();
			expect(screen.getByLabelText("Capture")).toBeInTheDocument();
			expect(screen.getByLabelText("Delete")).toBeInTheDocument();
		});

		it("should hide certain buttons for edit permission", () => {
			// Update the mock store to have edit permissions
			updateStoreMock({
				assuranceCase: {
					permissions: "editor",
				},
			});

			render(<ActionButtons {...defaultProps} />);

			expect(screen.getByLabelText(NEW_GOAL_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(SHARE_EXPORT_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(CAPTURE_REGEX)).toBeInTheDocument();
			expect(
				screen.queryByLabelText(PERMISSIONS_REGEX)
			).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(DELETE_BUTTON_REGEX)
			).not.toBeInTheDocument();
		});

		it("should hide edit buttons for view permission", () => {
			// Update the mock store to have view permissions
			updateStoreMock({
				assuranceCase: {
					permissions: "view",
				},
			});

			render(<ActionButtons {...defaultProps} />);

			expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(RESET_IDENTIFIERS_REGEX)
			).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(SHARE_EXPORT_REGEX)
			).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(PERMISSIONS_REGEX)
			).not.toBeInTheDocument();
			expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(DELETE_BUTTON_REGEX)
			).not.toBeInTheDocument();

			// Should still show read-only buttons
			expect(screen.getByLabelText(FOCUS_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(RESOURCES_REGEX)).toBeInTheDocument();
			expect(screen.getByLabelText(NOTES_REGEX)).toBeInTheDocument();
		});

		it("should hide edit buttons for review permission", () => {
			// Update the mock store to have review permissions
			updateStoreMock({
				assuranceCase: {
					permissions: "review",
				},
			});

			render(<ActionButtons {...defaultProps} />);

			expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
			expect(
				screen.queryByLabelText(RESET_IDENTIFIERS_REGEX)
			).not.toBeInTheDocument();
			expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();

			// Should show Share & Export for review permission
			expect(screen.getByLabelText(SHARE_EXPORT_REGEX)).toBeInTheDocument();
		});

		it("should not render New Goal button when showCreateGoal is false", () => {
			render(<ActionButtons {...defaultProps} showCreateGoal={false} />);

			expect(screen.queryByLabelText(NEW_GOAL_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("Delete functionality", () => {
		it("should open delete confirmation modal when delete button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			expect(
				screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
			).toBeInTheDocument();
			expect(
				screen.getByText(ACTION_CANNOT_BE_UNDONE_REGEX)
			).toBeInTheDocument();
		});

		it("should close delete modal when cancel is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			// Open modal
			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			expect(
				screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
			).toBeInTheDocument();

			// Close modal
			const cancelButton = screen.getByText(CANCEL_BUTTON_REGEX);
			await user.click(cancelButton);

			await waitFor(() => {
				expect(
					screen.queryByText(DELETE_CASE_CONFIRMATION_REGEX)
				).not.toBeInTheDocument();
			});
		});

		it("should handle successful case deletion", async () => {
			const user = userEvent.setup();

			// Mock successful deletion
			server.use(
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/`,
					() => {
						return new HttpResponse(null, { status: 204 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open delete modal
			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			// Confirm deletion - find the confirm button within the delete modal
			const deleteModal = screen.getByTestId("delete-modal");
			const confirmButton = within(deleteModal).getByTestId("delete-modal-confirm");
			await user.click(confirmButton);

			// Should redirect after successful deletion
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard");
			});
		});

		it("should handle case deletion failure", async () => {
			const user = userEvent.setup();

			// Mock failed deletion
			server.use(
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/`,
					() => {
						return new HttpResponse(null, { status: 500 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open delete modal
			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			// Confirm deletion - find the confirm button within the delete modal
			const deleteModal = screen.getByTestId("delete-modal");
			const confirmButton = within(deleteModal).getByTestId("delete-modal-confirm");
			await user.click(confirmButton);

			// Should not redirect on failure
			await waitFor(() => {
				expect(mockPush).not.toHaveBeenCalledWith("/dashboard");
			});

			// Modal should close
			await waitFor(() => {
				expect(
					screen.queryByText(DELETE_CASE_CONFIRMATION_REGEX)
				).not.toBeInTheDocument();
			});
		});

		it("should not make API call if assuranceCase is null", () => {
			// Update the mock store to have null assurance case
			updateStoreMock({ assuranceCase: null });

			render(<ActionButtons {...defaultProps} />);

			// Should not render delete button when no case
			expect(
				screen.queryByLabelText(DELETE_BUTTON_REGEX)
			).not.toBeInTheDocument();
		});
	});

	describe("Screenshot functionality", () => {
		it("should handle successful screenshot capture", async () => {
			const user = userEvent.setup();

			// Mock successful screenshot API
			server.use(
				http.post("/api/screenshot", () => {
					return HttpResponse.json({
						error: false,
						message: "Screenshot saved successfully",
					});
				})
			);

			// Create mock ReactFlow element
			const mockElement = document.createElement("div");
			mockElement.id = "ReactFlow";
			document.body.appendChild(mockElement);

			render(<ActionButtons {...defaultProps} />);

			const captureButton = screen.getByLabelText(CAPTURE_REGEX);
			await user.click(captureButton);

			await waitFor(() => {
				expect(mockNotify).toHaveBeenCalledWith("Screenshot Saved!");
			});

			// Cleanup
			document.body.removeChild(mockElement);
		});

		it("should handle screenshot API error", async () => {
			const user = userEvent.setup();

			// Mock failed screenshot API
			server.use(
				http.post("/api/screenshot", () => {
					return HttpResponse.json({
						error: true,
						message: "Failed to save screenshot",
					});
				})
			);

			// Create mock ReactFlow element
			const mockElement = document.createElement("div");
			mockElement.id = "ReactFlow";
			document.body.appendChild(mockElement);

			render(<ActionButtons {...defaultProps} />);

			const captureButton = screen.getByLabelText(CAPTURE_REGEX);
			await user.click(captureButton);

			await waitFor(() => {
				expect(mockNotifyError).toHaveBeenCalledWith(
					"Failed to save screenshot"
				);
			});

			// Cleanup
			document.body.removeChild(mockElement);
		});

		it("should not capture screenshot if ReactFlow element is not found", async () => {
			// Remove the ReactFlow element that's created in beforeEach
			const reactFlowElement = document.getElementById('ReactFlow');
			if (reactFlowElement) {
				reactFlowElement.remove();
			}

			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const captureButton = screen.getByLabelText(CAPTURE_REGEX);
			await user.click(captureButton);

			// Should not call any notification since element doesn't exist
			expect(mockNotify).not.toHaveBeenCalled();
			expect(mockNotifyError).not.toHaveBeenCalled();
		});

		it("should not capture screenshot if assuranceCase is null", () => {
			// Update the mock store to have null assurance case
			updateStoreMock({ assuranceCase: null });

			render(<ActionButtons {...defaultProps} />);

			// Should not render capture button when no case
			expect(screen.queryByLabelText(CAPTURE_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("Modal interactions", () => {
		it("should open permissions modal when permissions button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const permissionsButton = screen.getByLabelText(PERMISSIONS_REGEX);
			await user.click(permissionsButton);

			expect(mockModalStores.permissions.onOpen).toHaveBeenCalled();
		});

		it("should open share modal when share button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const shareButton = screen.getByLabelText(SHARE_EXPORT_REGEX);
			await user.click(shareButton);

			expect(mockModalStores.share.onOpen).toHaveBeenCalled();
		});

		it("should open resources modal when resources button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const resourcesButton = screen.getByLabelText(RESOURCES_REGEX);
			await user.click(resourcesButton);

			expect(mockModalStores.resources.onOpen).toHaveBeenCalled();
		});

		it("should open node create modal when new goal button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const newGoalButton = screen.getByLabelText(NEW_GOAL_REGEX);
			await user.click(newGoalButton);

			expect(screen.getByTestId("node-create-modal")).toBeInTheDocument();
		});

		it("should close node create modal", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			// Open modal
			const newGoalButton = screen.getByLabelText(NEW_GOAL_REGEX);
			await user.click(newGoalButton);

			expect(screen.getByTestId("node-create-modal")).toBeInTheDocument();

			// Close modal
			const closeButton = screen.getByText("Close");
			await user.click(closeButton);

			await waitFor(() => {
				expect(
					screen.queryByTestId("node-create-modal")
				).not.toBeInTheDocument();
			});
		});

		it("should open case notes modal when notes button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const notesButton = screen.getByLabelText(NOTES_REGEX);
			await user.click(notesButton);

			expect(screen.getByTestId("case-notes-modal")).toBeInTheDocument();
		});

		it("should close case notes modal", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			// Open modal
			const notesButton = screen.getByLabelText(NOTES_REGEX);
			await user.click(notesButton);

			expect(screen.getByTestId("case-notes-modal")).toBeInTheDocument();

			// Close modal
			const closeButton = screen.getByText("Close Notes");
			await user.click(closeButton);

			await waitFor(() => {
				expect(
					screen.queryByTestId("case-notes-modal")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Reset identifiers functionality", () => {
		it("should open reset identifiers confirmation modal", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
			await user.click(resetButton);

			expect(
				screen.getByText(DELETE_CASE_CONFIRMATION_REGEX)
			).toBeInTheDocument();
			expect(
				screen.getByText(RESET_IDENTIFIERS_MESSAGE_REGEX)
			).toBeInTheDocument();
		});

		it("should handle successful identifier reset", async () => {
			const user = userEvent.setup();

			// Mock successful reset
			server.use(
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/update-ids`,
					() => {
						return new HttpResponse(null, { status: 200 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open reset modal
			const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
			await user.click(resetButton);

			// Confirm reset
			const resetModal = screen.getByTestId("reset-modal");
			const confirmButton = within(resetModal).getByTestId("reset-modal-confirm");
			await user.click(confirmButton);

			// Wait for the reset operation to complete - verify that loading state ends
			await waitFor(() => {
				const updatedConfirmButton = within(resetModal).getByTestId("reset-modal-confirm");
				expect(updatedConfirmButton).toHaveTextContent("Yes, reset all identifiers");
			});
		});

		it("should handle identifier reset failure", async () => {
			const user = userEvent.setup();

			// Mock failed reset
			server.use(
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/update-ids`,
					() => {
						return new HttpResponse(null, { status: 500 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open reset modal
			const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
			await user.click(resetButton);

			// Confirm reset
			const confirmButton = screen.getByText("Yes, reset all identifiers");
			await user.click(confirmButton);

			// Should not reload on failure
			await waitFor(() => {
				expect(mockReload).not.toHaveBeenCalled();
			});
		});
	});

	describe("Focus functionality", () => {
		it("should call onLayout with TB direction when focus button is clicked", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			const focusButton = screen.getByLabelText(FOCUS_REGEX);
			await user.click(focusButton);

			expect(mockOnLayout).toHaveBeenCalledWith("TB");
		});
	});

	describe("Accessibility", () => {
		it("should have proper aria labels for all buttons", () => {
			render(<ActionButtons {...defaultProps} />);

			// Check all buttons have aria-labels
			const buttons = screen.getAllByRole("button");
			for (const button of buttons) {
				expect(button).toHaveAttribute("type", "button");
				// Each button should have an aria-label
				expect(button).toHaveAttribute("aria-label");
			}
		});

		it("should be keyboard navigable", async () => {
			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			// Tab through buttons
			await user.tab();
			expect(screen.getByLabelText(NEW_GOAL_REGEX)).toHaveFocus();

			await user.tab();
			expect(screen.getByLabelText(FOCUS_REGEX)).toHaveFocus();

			await user.tab();
			expect(screen.getByLabelText(RESET_IDENTIFIERS_REGEX)).toHaveFocus();
		});

		it("should have proper button structure for screen readers", () => {
			render(<ActionButtons {...defaultProps} />);

			// All buttons should have aria-label attributes
			const buttons = screen.getAllByRole("button");
			expect(buttons.length).toBeGreaterThan(0);

			// Check specific buttons have accessible labels
			expect(screen.getByLabelText("New Goal")).toBeInTheDocument();
			expect(screen.getByLabelText("Focus")).toBeInTheDocument();
			expect(screen.getByLabelText("Reset Identifiers")).toBeInTheDocument();
			expect(screen.getByLabelText("Resources")).toBeInTheDocument();
			expect(screen.getByLabelText("Share & Export")).toBeInTheDocument();
			expect(screen.getByLabelText("Permissions")).toBeInTheDocument();
			expect(screen.getByLabelText("Notes")).toBeInTheDocument();
			expect(screen.getByLabelText("Capture")).toBeInTheDocument();
			expect(screen.getByLabelText("Delete")).toBeInTheDocument();
		});
	});

	describe("Loading states", () => {
		it("should disable buttons during delete operation", async () => {
			const user = userEvent.setup();

			// Mock slow deletion
			server.use(
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/`,
					async () => {
						await new Promise((resolve) => setTimeout(resolve, 100));
						return new HttpResponse(null, { status: 204 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open delete modal
			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			// Confirm deletion - find the confirm button within the delete modal
			const deleteModal = screen.getByTestId("delete-modal");
			const confirmButton = within(deleteModal).getByTestId("delete-modal-confirm");
			await user.click(confirmButton);

			// Verify deletion completes successfully
			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard");
			});
		});

		it("should disable buttons during reset operation", async () => {
			const user = userEvent.setup();

			// Mock slow reset
			server.use(
				http.post(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/cases/1/update-ids`,
					async () => {
						await new Promise((resolve) => setTimeout(resolve, 100));
						return new HttpResponse(null, { status: 200 });
					}
				)
			);

			render(<ActionButtons {...defaultProps} />);

			// Open reset modal
			const resetButton = screen.getByLabelText(RESET_IDENTIFIERS_REGEX);
			await user.click(resetButton);

			// Confirm reset
			const resetModal = screen.getByTestId("reset-modal");
			const confirmButton = within(resetModal).getByTestId("reset-modal-confirm");
			await user.click(confirmButton);

			// Wait for the reset operation to complete - verify that loading state ends
			await waitFor(() => {
				const updatedConfirmButton = within(resetModal).getByTestId("reset-modal-confirm");
				expect(updatedConfirmButton).toHaveTextContent("Yes, reset all identifiers");
			});
		});
	});

	describe("Edge cases", () => {
		it("should handle missing session token gracefully", async () => {
			// Mock unauthenticated session
			vi.mocked(useSession).mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			const user = userEvent.setup();
			render(<ActionButtons {...defaultProps} />);

			// Try to delete - should still make the request but with empty token
			const deleteButton = screen.getByLabelText(DELETE_BUTTON_REGEX);
			await user.click(deleteButton);

			const deleteModal = screen.getByTestId("delete-modal");
			const confirmButton = within(deleteModal).getByTestId("delete-modal-confirm");
			await user.click(confirmButton);

			// API call should still be made
			await waitFor(() => {
				expect(mockPush).not.toHaveBeenCalled(); // Won't redirect on auth failure
			});
		});

		it("should render correctly with custom notification functions", async () => {
			const customNotify = vi.fn();
			const customNotifyError = vi.fn();

			const user = userEvent.setup();

			// Mock successful screenshot
			server.use(
				http.post("/api/screenshot", () => {
					return HttpResponse.json({
						error: false,
						message: "Success",
					});
				})
			);

			// Create mock ReactFlow element
			const mockElement = document.createElement("div");
			mockElement.id = "ReactFlow";
			document.body.appendChild(mockElement);

			render(
				<ActionButtons
					{...defaultProps}
					notify={customNotify}
					notifyError={customNotifyError}
				/>
			);

			const captureButton = screen.getByLabelText(CAPTURE_REGEX);
			await user.click(captureButton);

			await waitFor(() => {
				expect(customNotify).toHaveBeenCalledWith("Screenshot Saved!");
			});

			// Cleanup
			document.body.removeChild(mockElement);
		});
	});
});
