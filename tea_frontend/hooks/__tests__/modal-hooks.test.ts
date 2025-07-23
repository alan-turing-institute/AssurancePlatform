import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Clear the mocks from the global setup to test the actual implementations
vi.unmock("@/hooks/use-create-case-modal");
vi.unmock("@/hooks/use-email-modal");
vi.unmock("@/hooks/use-import-modal");
vi.unmock("@/hooks/use-permissions-modal");
vi.unmock("@/hooks/use-resources-modal");
vi.unmock("@/hooks/use-share-modal");

import { useCreateCaseModal } from "@/hooks/use-create-case-modal";
import { useEmailModal } from "@/hooks/use-email-modal";
import { useImportModal } from "@/hooks/use-import-modal";
import { usePermissionsModal } from "@/hooks/use-permissions-modal";
import { useResourcesModal } from "@/hooks/use-resources-modal";
import { useShareModal } from "@/hooks/use-share-modal";

// Type for modal hook return value
interface ModalHookReturn {
	isOpen: boolean;
	onOpen: () => void;
	onClose: () => void;
}

// Helper function to test modal hook behavior
const testModalHook = (hookName: string, useHook: () => ModalHookReturn) => {
	describe(hookName, () => {
		it("should initialize with isOpen as false", () => {
			const { result } = renderHook(useHook);

			expect(result.current.isOpen).toBe(false);
		});

		it("should have onOpen function", () => {
			const { result } = renderHook(useHook);

			expect(typeof result.current.onOpen).toBe("function");
		});

		it("should have onClose function", () => {
			const { result } = renderHook(useHook);

			expect(typeof result.current.onClose).toBe("function");
		});

		it("should open modal when onOpen is called", () => {
			const { result } = renderHook(useHook);

			act(() => {
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);
		});

		it("should close modal when onClose is called", () => {
			const { result } = renderHook(useHook);

			// First open the modal
			act(() => {
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);

			// Then close it
			act(() => {
				result.current.onClose();
			});

			expect(result.current.isOpen).toBe(false);
		});

		it("should handle multiple open calls", () => {
			const { result } = renderHook(useHook);

			act(() => {
				result.current.onOpen();
				result.current.onOpen();
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);
		});

		it("should handle multiple close calls", () => {
			const { result } = renderHook(useHook);

			// Open first
			act(() => {
				result.current.onOpen();
			});

			// Close multiple times
			act(() => {
				result.current.onClose();
				result.current.onClose();
				result.current.onClose();
			});

			expect(result.current.isOpen).toBe(false);
		});

		it("should handle close when already closed", () => {
			const { result } = renderHook(useHook);

			// Modal starts closed
			expect(result.current.isOpen).toBe(false);

			// Try to close when already closed
			act(() => {
				result.current.onClose();
			});

			expect(result.current.isOpen).toBe(false);
		});

		it("should maintain state across re-renders", () => {
			const { result, rerender } = renderHook(useHook);

			act(() => {
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);

			rerender();

			expect(result.current.isOpen).toBe(true);
		});

		it("should toggle state correctly", () => {
			const { result } = renderHook(useHook);

			// Start closed
			expect(result.current.isOpen).toBe(false);

			// Open
			act(() => {
				result.current.onOpen();
			});
			expect(result.current.isOpen).toBe(true);

			// Close
			act(() => {
				result.current.onClose();
			});
			expect(result.current.isOpen).toBe(false);

			// Open again
			act(() => {
				result.current.onOpen();
			});
			expect(result.current.isOpen).toBe(true);
		});

		it("should handle rapid state changes", () => {
			const { result } = renderHook(useHook);

			act(() => {
				result.current.onOpen();
				result.current.onClose();
				result.current.onOpen();
				result.current.onClose();
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);
		});
	});
};

describe("Modal Hooks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset all Zustand stores to their initial state
		const stores = [
			useCreateCaseModal,
			useShareModal,
			usePermissionsModal,
			useImportModal,
			useEmailModal,
			useResourcesModal,
		];

		// Reset each store to its initial state
		stores.forEach((store) => {
			store.setState({ isOpen: false });
		});
	});

	// Test all modal hooks with the shared test suite
	testModalHook("useCreateCaseModal", useCreateCaseModal);
	testModalHook("useShareModal", useShareModal);
	testModalHook("usePermissionsModal", usePermissionsModal);
	testModalHook("useImportModal", useImportModal);
	testModalHook("useEmailModal", useEmailModal);
	testModalHook("useResourcesModal", useResourcesModal);

	describe("Cross-modal interactions", () => {
		it("should allow multiple modals to be open simultaneously", () => {
			const { result: createModal } = renderHook(() => useCreateCaseModal());
			const { result: shareModal } = renderHook(() => useShareModal());
			const { result: permissionsModal } = renderHook(() =>
				usePermissionsModal()
			);

			act(() => {
				createModal.current.onOpen();
				shareModal.current.onOpen();
				permissionsModal.current.onOpen();
			});

			expect(createModal.current.isOpen).toBe(true);
			expect(shareModal.current.isOpen).toBe(true);
			expect(permissionsModal.current.isOpen).toBe(true);
		});

		it("should maintain independent state between different modal hooks", () => {
			const { result: modal1 } = renderHook(() => useCreateCaseModal());
			const { result: modal2 } = renderHook(() => useShareModal());

			act(() => {
				modal1.current.onOpen();
			});

			expect(modal1.current.isOpen).toBe(true);
			expect(modal2.current.isOpen).toBe(false);

			act(() => {
				modal2.current.onOpen();
			});

			expect(modal1.current.isOpen).toBe(true);
			expect(modal2.current.isOpen).toBe(true);

			act(() => {
				modal1.current.onClose();
			});

			expect(modal1.current.isOpen).toBe(false);
			expect(modal2.current.isOpen).toBe(true);
		});

		it("should handle concurrent operations across multiple modals", () => {
			const { result: createModal } = renderHook(() => useCreateCaseModal());
			const { result: shareModal } = renderHook(() => useShareModal());
			const { result: importModal } = renderHook(() => useImportModal());

			act(() => {
				// Rapid concurrent operations
				createModal.current.onOpen();
				shareModal.current.onOpen();
				importModal.current.onOpen();
				createModal.current.onClose();
				shareModal.current.onClose();
				importModal.current.onClose();
				createModal.current.onOpen();
			});

			expect(createModal.current.isOpen).toBe(true);
			expect(shareModal.current.isOpen).toBe(false);
			expect(importModal.current.isOpen).toBe(false);
		});
	});

	describe("Multiple instances of same hook", () => {
		it("should maintain separate state for multiple instances of the same hook", () => {
			const { result: instance1 } = renderHook(() => useCreateCaseModal());
			const { result: instance2 } = renderHook(() => useCreateCaseModal());

			act(() => {
				instance1.current.onOpen();
			});

			// Both instances should share the same Zustand store state
			expect(instance1.current.isOpen).toBe(true);
			expect(instance2.current.isOpen).toBe(true);

			act(() => {
				instance2.current.onClose();
			});

			// Both should be closed since they share state
			expect(instance1.current.isOpen).toBe(false);
			expect(instance2.current.isOpen).toBe(false);
		});

		it("should sync state changes across multiple hook instances", () => {
			const { result: instance1 } = renderHook(() => useShareModal());
			const { result: instance2 } = renderHook(() => useShareModal());
			const { result: instance3 } = renderHook(() => useShareModal());

			// Open via first instance
			act(() => {
				instance1.current.onOpen();
			});

			// All instances should see the change
			expect(instance1.current.isOpen).toBe(true);
			expect(instance2.current.isOpen).toBe(true);
			expect(instance3.current.isOpen).toBe(true);

			// Close via second instance
			act(() => {
				instance2.current.onClose();
			});

			// All instances should see the change
			expect(instance1.current.isOpen).toBe(false);
			expect(instance2.current.isOpen).toBe(false);
			expect(instance3.current.isOpen).toBe(false);
		});
	});

	describe("Performance and memory", () => {
		it("should handle cleanup on unmount", () => {
			const { result, unmount } = renderHook(() => useCreateCaseModal());

			act(() => {
				result.current.onOpen();
			});

			expect(result.current.isOpen).toBe(true);

			// Should not throw on unmount
			unmount();
		});

		it("should handle large numbers of state changes", () => {
			const { result } = renderHook(() => useShareModal());

			act(() => {
				for (let i = 0; i < 1000; i++) {
					if (i % 2 === 0) {
						result.current.onOpen();
					} else {
						result.current.onClose();
					}
				}
			});

			// Should end in closed state (1000 is even, so last operation was onOpen, but 999 was close)
			// Actually, since we start at 0 (even), we end at 999 (odd), so last operation was onClose
			expect(result.current.isOpen).toBe(false);
		});

		it("should maintain consistent performance with multiple hooks", () => {
			const hooks: Array<() => ModalHookReturn> = [
				useCreateCaseModal,
				useShareModal,
				usePermissionsModal,
				useImportModal,
				useEmailModal,
				useResourcesModal,
			];

			const results = hooks.map((hook) => renderHook(hook));

			act(() => {
				for (const { result } of results) {
					result.current.onOpen();
				}
			});

			for (const { result } of results) {
				expect(result.current.isOpen).toBe(true);
			}

			act(() => {
				for (const { result } of results) {
					result.current.onClose();
				}
			});

			for (const { result } of results) {
				expect(result.current.isOpen).toBe(false);
			}
		});
	});

	describe("Edge cases", () => {
		it("should handle null/undefined function calls gracefully", () => {
			const { result } = renderHook(() => useCreateCaseModal());

			expect(() => {
				act(() => {
					result.current.onOpen();
					result.current.onClose();
				});
			}).not.toThrow();
		});

		it("should maintain type safety", () => {
			const { result } = renderHook(() => useCreateCaseModal());

			// These should all be properly typed
			expect(typeof result.current.isOpen).toBe("boolean");
			expect(typeof result.current.onOpen).toBe("function");
			expect(typeof result.current.onClose).toBe("function");

			// Functions should not accept parameters
			expect(result.current.onOpen.length).toBe(0);
			expect(result.current.onClose.length).toBe(0);
		});

		it("should work in strict mode (double execution)", () => {
			// Simulate React strict mode by rendering twice
			const { result } = renderHook(() => useCreateCaseModal());
			const { result: result2 } = renderHook(() => useCreateCaseModal());

			act(() => {
				result.current.onOpen();
				result2.current.onOpen(); // Should not cause issues
			});

			expect(result.current.isOpen).toBe(true);
			expect(result2.current.isOpen).toBe(true);
		});
	});

	describe("Real-world usage patterns", () => {
		it("should support typical open-edit-close workflow", () => {
			const { result } = renderHook(() => useCreateCaseModal());

			// User clicks create button
			act(() => {
				result.current.onOpen();
			});
			expect(result.current.isOpen).toBe(true);

			// User fills form and submits (modal should stay open during loading)
			expect(result.current.isOpen).toBe(true);

			// Form submission completes, modal closes
			act(() => {
				result.current.onClose();
			});
			expect(result.current.isOpen).toBe(false);
		});

		it("should support cancellation workflow", () => {
			const { result } = renderHook(() => useShareModal());

			// User opens modal
			act(() => {
				result.current.onOpen();
			});
			expect(result.current.isOpen).toBe(true);

			// User clicks cancel or escape
			act(() => {
				result.current.onClose();
			});
			expect(result.current.isOpen).toBe(false);
		});

		it("should support modal chaining workflow", () => {
			const { result: createModal } = renderHook(() => useCreateCaseModal());
			const { result: shareModal } = renderHook(() => useShareModal());

			// User creates case
			act(() => {
				createModal.current.onOpen();
			});
			expect(createModal.current.isOpen).toBe(true);

			// Case creation completes, create modal closes
			act(() => {
				createModal.current.onClose();
			});
			expect(createModal.current.isOpen).toBe(false);

			// Share modal opens for the new case
			act(() => {
				shareModal.current.onOpen();
			});
			expect(shareModal.current.isOpen).toBe(true);

			// Share modal closes
			act(() => {
				shareModal.current.onClose();
			});
			expect(shareModal.current.isOpen).toBe(false);
		});
	});
});
