import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/ui/use-toast";
import useStore from "@/data/store";
import {
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	removeAssuranceCaseNode,
} from "@/lib/case-helper";
import type { AssuranceCase } from "@/types";
import NodeContext from "../node-context";

// Mock dependencies
vi.mock("@/lib/case-helper");
vi.mock("@/data/store");
vi.mock("@/components/ui/use-toast");

const mockSession = {
	user: { email: "test@example.com", name: "Test User" },
	key: "mock-jwt-token",
	expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const mockNode: Node = {
	id: "1",
	type: "goal",
	data: { id: 1, name: "Test Goal" },
	position: { x: 0, y: 0 },
};

const mockActions = {
	setSelectedLink: vi.fn(),
	setLinkToCreate: vi.fn(),
	handleClose: vi.fn(),
	setAction: vi.fn(),
};

const mockContext = {
	id: 1,
	name: "Test Context",
	short_description: "Test context description",
	long_description: "Test context long description",
	created_date: "2024-01-01",
	type: "Context",
};

describe("NodeContext", () => {
	const mockSetAssuranceCase = vi.fn();
	const mockSetActiveUsers = vi.fn();
	const mockSetUnresolvedChanges = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock useStore
		vi.mocked(useStore).mockReturnValue({
			assuranceCase: {
				id: 1,
				goals: [
					{
						id: 1,
						context: [mockContext],
					},
				],
			},
			setAssuranceCase: mockSetAssuranceCase,
			activeUsers: [],
			setActiveUsers: mockSetActiveUsers,
		} as ReturnType<typeof useStore>);

		// Mock toast
		vi.mocked(toast).mockImplementation(() => ({
			id: "mock-id",
			dismiss: () => {},
			update: () => {},
		}));
	});

	it("renders existing contexts", () => {
		render(
			<SessionProvider session={mockSession}>
				<NodeContext
					actions={mockActions}
					node={mockNode}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			</SessionProvider>
		);

		expect(
			screen.getByText("Test context long description")
		).toBeInTheDocument();
		// Check that the context name is rendered
		const contextInfo = screen.getByText(/Test Context/);
		expect(contextInfo).toBeInTheDocument();
	});

	it("handles context deletion successfully", async () => {
		vi.mocked(deleteAssuranceCaseNode).mockResolvedValue(true);
		vi.mocked(removeAssuranceCaseNode).mockReturnValue({
			id: 1,
			name: "Test Case",
			type: "AssuranceCase",
			lock_uuid: null,
			comments: [],
			permissions: "manage",
			created_date: "2023-01-01T00:00:00Z",
			goals: [
				{
					id: 1,
					type: "Goal",
					name: "Test Goal",
					short_description: "Test goal description",
					long_description: "Test goal long description",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				},
			],
		} as AssuranceCase);

		render(
			<SessionProvider session={mockSession}>
				<NodeContext
					actions={mockActions}
					node={mockNode}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			</SessionProvider>
		);

		// Hover over the context item to show the Remove button
		const contextItem = screen
			.getByText("Test context long description")
			.closest("div");
		if (contextItem) {
			fireEvent.mouseEnter(contextItem);
		}

		// Click the Remove button
		const removeButton = screen.getByText("Remove");
		fireEvent.click(removeButton);

		await waitFor(() => {
			// Verify API calls
			expect(deleteAssuranceCaseNode).toHaveBeenCalledWith(
				"context",
				1,
				"mock-jwt-token"
			);
			expect(removeAssuranceCaseNode).toHaveBeenCalledWith(
				expect.any(Object),
				1,
				"context"
			);

			// Verify state updates
			expect(mockSetAssuranceCase).toHaveBeenCalledWith({
				id: 1,
				goals: [
					{
						id: 1,
						context: [],
					},
				],
			});

			// Verify success toast
			expect(toast).toHaveBeenCalledWith({
				title: "Context deleted",
				description: "The context has been successfully removed.",
			});
		});

		// Verify the context is removed from the UI
		expect(
			screen.queryByText("Test context long description")
		).not.toBeInTheDocument();
	});

	it("handles context deletion failure", async () => {
		vi.mocked(deleteAssuranceCaseNode).mockResolvedValue({
			error: "Failed to delete node",
		});

		render(
			<SessionProvider session={mockSession}>
				<NodeContext
					actions={mockActions}
					node={mockNode}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			</SessionProvider>
		);

		// Hover over the context item to show the Remove button
		const contextItem = screen
			.getByText("Test context long description")
			.closest("div");
		if (contextItem) {
			fireEvent.mouseEnter(contextItem);
		}

		// Click the Remove button
		const removeButton = screen.getByText("Remove");
		fireEvent.click(removeButton);

		await waitFor(() => {
			// Verify error toast
			expect(toast).toHaveBeenCalledWith({
				title: "Error",
				description: "Failed to delete node",
				variant: "destructive",
			});
		});

		// Verify the context is still in the UI
		expect(
			screen.getByText("Test context long description")
		).toBeInTheDocument();
	});

	it("adds a new context", async () => {
		vi.mocked(createAssuranceCaseNode).mockResolvedValue({
			data: {
				id: 2,
				name: "New Context",
				short_description: "New context description",
				long_description: "New context description",
				created_date: "2024-01-02",
				type: "Context",
			},
			error: null,
		});

		render(
			<SessionProvider session={mockSession}>
				<NodeContext
					actions={mockActions}
					node={mockNode}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			</SessionProvider>
		);

		// Fill in the description
		const textarea = screen.getByPlaceholderText("Type your description here.");
		fireEvent.change(textarea, {
			target: { value: "New context description" },
		});

		// Submit the form
		const addButton = screen.getByText("Add Context");
		fireEvent.click(addButton);

		await waitFor(() => {
			// Verify API call
			expect(createAssuranceCaseNode).toHaveBeenCalledWith(
				"contexts",
				{
					short_description: "New context description",
					long_description: "New context description",
					goal_id: 1,
					type: "Context",
				},
				"mock-jwt-token"
			);

			// Verify state update
			expect(mockSetAssuranceCase).toHaveBeenCalled();
		});
	});
});
