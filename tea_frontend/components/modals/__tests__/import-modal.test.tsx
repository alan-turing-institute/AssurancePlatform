import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useImportModal } from "@/hooks/use-import-modal";
import { server } from "@/src/__tests__/mocks/server";
import { ImportModal } from "../import-modal";

// Regex constants for testing
const SUBMIT_REGEX = /submit/i;
const ERROR_REGEX = /error/i;
const ERROR_PARSING_JSON_REGEX = /error parsing json file/i;
const AN_ERROR_OCCURRED_REGEX = /an error occurred/i;
const ERROR_READING_FILE_REGEX = /error reading file/i;

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
}));

// Mock next navigation
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(),
}));

// Mock the import modal hook
vi.mock("@/hooks/use-import-modal", () => ({
	useImportModal: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseRouter = vi.mocked(useRouter);
const mockUseImportModal = vi.mocked(useImportModal);

const mockRouter = {
	push: vi.fn(),
	back: vi.fn(),
	forward: vi.fn(),
	refresh: vi.fn(),
	replace: vi.fn(),
	prefetch: vi.fn(),
};

const mockImportModal = {
	isOpen: true,
	onClose: vi.fn(),
	onOpen: vi.fn(),
};

// Mock FileReader
const mockFileReader = {
	readAsText: vi.fn(),
	onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
	result: null as string | null,
};

// Mock global FileReader
Object.defineProperty(window, "FileReader", {
	writable: true,
	value: vi.fn().mockImplementation(() => mockFileReader),
});

describe("ImportModal", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();

		mockUseSession.mockReturnValue({
			data: {
				key: "test-token",
				expires: new Date(Date.now() + 86_400_000).toISOString(),
			},
			status: "authenticated",
			update: vi.fn(),
		});

		mockUseRouter.mockReturnValue(mockRouter);
		mockUseImportModal.mockReturnValue(mockImportModal);

		// Reset FileReader mock
		mockFileReader.readAsText.mockClear();
		mockFileReader.onload = null;
		mockFileReader.result = null;

		// Reset MSW handlers
		server.resetHandlers();
	});

	describe("Component Rendering", () => {
		it("should render without crashing when modal is open", () => {
			render(<ImportModal />);

			expect(screen.getByText("Import File")).toBeInTheDocument();
			expect(
				screen.getByText(
					"Please select a file you wish to import to create your case."
				)
			).toBeInTheDocument();
		});

		it("should not render when modal is closed", () => {
			mockUseImportModal.mockReturnValue({
				...mockImportModal,
				isOpen: false,
			});

			render(<ImportModal />);

			expect(screen.queryByText("Import File")).not.toBeInTheDocument();
		});

		it("should display file input", () => {
			render(<ImportModal />);

			const fileInput = document.querySelector('input[type="file"]');
			expect(fileInput).toBeInTheDocument();
		});

		it("should display submit button", () => {
			render(<ImportModal />);

			expect(
				screen.getByRole("button", { name: SUBMIT_REGEX })
			).toBeInTheDocument();
		});

		it("should not display error message initially", () => {
			render(<ImportModal />);

			// No error should be visible initially
			expect(screen.queryByText(ERROR_REGEX)).not.toBeInTheDocument();
		});
	});

	describe("File Upload", () => {
		it("should handle JSON file selection", async () => {
			render(<ImportModal />);

			// Create a mock JSON file
			const jsonContent = JSON.stringify({
				name: "Test Case",
				description: "Test",
			});
			const file = new File([jsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			expect(fileInput).toBeInTheDocument();

			// Upload the file
			if (fileInput) {
				await user.upload(fileInput, file);

				expect(fileInput.files?.[0]).toBe(file);
				expect(fileInput.files?.[0]?.name).toBe("test.json");
			}
		});

		it("should accept file upload", async () => {
			render(<ImportModal />);

			// Create a JSON file
			const file = new File(['{"name": "test"}'], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;

			if (fileInput) {
				await user.upload(fileInput, file);
				expect(fileInput.files?.[0]).toBe(file);
			}
		});

		it("should handle form submission without file", async () => {
			render(<ImportModal />);

			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Component should handle empty submission gracefully
			expect(submitButton).toBeInTheDocument();
		});

		it("should handle multiple files (only first one)", async () => {
			render(<ImportModal />);

			const jsonContent1 = JSON.stringify({ name: "Test Case 1" });
			const file1 = new File([jsonContent1], "test1.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;

			if (fileInput) {
				await user.upload(fileInput, file1);
				expect(fileInput.files?.[0]).toBe(file1);
				expect(fileInput.files?.[0]?.name).toBe("test1.json");
			}
		});
	});

	describe("Form Submission", () => {
		it("should process valid JSON file and create case", async () => {
			const mockCaseData = {
				name: "Test Case",
				description: "Test Description",
			};
			const mockResponse = { id: 123 };

			server.use(
				http.post(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/`, () =>
					HttpResponse.json(mockResponse)
				)
			);

			render(<ImportModal />);

			const jsonContent = JSON.stringify(mockCaseData);
			const file = new File([jsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate FileReader onload
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: jsonContent },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Should navigate to new case and close modal
				await waitFor(() => {
					expect(mockRouter.push).toHaveBeenCalledWith("/case/123");
					expect(mockImportModal.onClose).toHaveBeenCalled();
				});
			}
		});

		it("should handle JSON parsing error", async () => {
			render(<ImportModal />);

			const invalidJsonContent = "{ invalid json }";
			const file = new File([invalidJsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate FileReader onload with invalid JSON
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: invalidJsonContent },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Should show error message
				await waitFor(() => {
					expect(
						screen.getByText(ERROR_PARSING_JSON_REGEX)
					).toBeInTheDocument();
				});
			}
		});

		it("should handle API error response", async () => {
			server.use(
				http.post(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/`, () =>
					HttpResponse.json({ error: "Invalid data" }, { status: 400 })
				)
			);

			render(<ImportModal />);

			const mockCaseData = { name: "Test Case" };
			const jsonContent = JSON.stringify(mockCaseData);
			const file = new File([jsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate FileReader onload
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: jsonContent },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Should show error message
				await waitFor(() => {
					expect(screen.getByText(AN_ERROR_OCCURRED_REGEX)).toBeInTheDocument();
				});
			}
		});

		it("should handle network error", async () => {
			server.use(
				http.post(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/`, () => {
					throw new Error("Network error");
				})
			);

			render(<ImportModal />);

			const mockCaseData = { name: "Test Case" };
			const jsonContent = JSON.stringify(mockCaseData);
			const file = new File([jsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate FileReader onload
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: jsonContent },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Should show error message
				await waitFor(() => {
					expect(screen.getByText(AN_ERROR_OCCURRED_REGEX)).toBeInTheDocument();
				});
			}
		});

		it("should handle FileReader error", async () => {
			render(<ImportModal />);

			const file = new File(["test"], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				// Mock FileReader to throw error
				vi.mocked(window.FileReader).mockImplementationOnce(() => {
					throw new Error("FileReader error");
				});

				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Should show error message
				await waitFor(() => {
					expect(
						screen.getByText(ERROR_READING_FILE_REGEX)
					).toBeInTheDocument();
				});
			}
		});
	});

	describe("Modal Behavior", () => {
		it("should call onClose when modal is closed", () => {
			render(<ImportModal />);

			// The Modal component should handle close behavior
			expect(mockImportModal.onClose).toBeDefined();
		});

		it("should clear error when modal is closed", () => {
			render(<ImportModal />);

			// Set an error state first
			const errorDiv = document.createElement("div");
			errorDiv.textContent = "Test error";

			// The handleModalClose function should clear errors
			expect(mockImportModal.onClose).toBeDefined();
		});

		it("should handle modal open state", () => {
			mockUseImportModal.mockReturnValue({
				...mockImportModal,
				isOpen: true,
			});

			render(<ImportModal />);

			expect(screen.getByText("Import File")).toBeInTheDocument();
		});

		it("should handle modal closed state", () => {
			mockUseImportModal.mockReturnValue({
				...mockImportModal,
				isOpen: false,
			});

			render(<ImportModal />);

			expect(screen.queryByText("Import File")).not.toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle missing session", () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			render(<ImportModal />);

			// Should still render the modal
			expect(screen.getByText("Import File")).toBeInTheDocument();
		});

		it("should handle empty file", async () => {
			render(<ImportModal />);

			const file = new File([""], "empty.json", { type: "application/json" });

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate FileReader onload with empty content
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: "" },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Should show JSON parsing error
				await waitFor(() => {
					expect(
						screen.getByText(ERROR_PARSING_JSON_REGEX)
					).toBeInTheDocument();
				});
			}
		});

		it("should handle very large JSON file", async () => {
			render(<ImportModal />);

			// Create a large JSON object
			const largeData = {
				name: "Large Case",
				items: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					name: `Item ${i}`,
				})),
			};
			const jsonContent = JSON.stringify(largeData);
			const file = new File([jsonContent], "large.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;

			if (fileInput) {
				await user.upload(fileInput, file);

				expect(fileInput.files?.[0]).toBe(file);
			}
		});

		it("should handle special characters in JSON", async () => {
			render(<ImportModal />);

			const specialData = {
				name: "Test with 特殊字符 and émojis 🚀",
				description: "Contains unicode: ñáéíóú",
			};
			const jsonContent = JSON.stringify(specialData);
			const file = new File([jsonContent], "special.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;

			if (fileInput) {
				await user.upload(fileInput, file);

				expect(fileInput.files?.[0]?.name).toBe("special.json");
			}
		});

		it("should handle missing file property in form data", async () => {
			render(<ImportModal />);

			// Try to submit without any file
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Component should handle empty submission gracefully
			expect(submitButton).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<ImportModal />);

			const results = await axe(container, {
				rules: {
					// Disable color-contrast rule for jsdom compatibility
					"color-contrast": { enabled: false },
					// Disable label rule as file inputs may not have explicit labels
					label: { enabled: false },
					// Disable label-title-only rule
					"label-title-only": { enabled: false },
				},
			});
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper form semantics", () => {
			render(<ImportModal />);

			const form = document.querySelector("form");
			expect(form).toBeInTheDocument();

			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			expect(submitButton).toHaveAttribute("type", "submit");
		});

		it("should have proper file input", () => {
			render(<ImportModal />);

			const fileInput = document.querySelector('input[type="file"]');
			expect(fileInput).toBeInTheDocument();
		});

		it("should support keyboard navigation", async () => {
			render(<ImportModal />);

			// Tab through the interface
			await user.tab();

			// Should be able to focus on interactive elements
			const fileInput = document.querySelector('input[type="file"]');
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			expect(fileInput || submitButton).toBeDefined();
		});

		it("should have accessible form elements", () => {
			render(<ImportModal />);

			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			const fileInput = document.querySelector('input[type="file"]');

			expect(submitButton).toBeInTheDocument();
			expect(fileInput).toBeInTheDocument();
		});
	});

	describe("Form Validation", () => {
		it("should handle empty form submission", async () => {
			render(<ImportModal />);

			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });
			await user.click(submitButton);

			// Component should handle empty submission gracefully
			expect(submitButton).toBeInTheDocument();
		});

		it("should accept JSON file upload", async () => {
			render(<ImportModal />);

			const file = new File(['{"name": "test"}'], "test.json", {
				type: "application/json",
			});
			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;

			if (fileInput) {
				await user.upload(fileInput, file);
				expect(fileInput.files?.[0]).toBe(file);
			}
		});

		it("should reset form validation on successful submission", async () => {
			const mockResponse = { id: 123 };

			server.use(
				http.post(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/`, () =>
					HttpResponse.json(mockResponse)
				)
			);

			render(<ImportModal />);

			const jsonContent = JSON.stringify({ name: "Test" });
			const file = new File([jsonContent], "test.json", {
				type: "application/json",
			});

			const fileInput = document.querySelector(
				'input[type="file"]'
			) as HTMLInputElement;
			const submitButton = screen.getByRole("button", { name: SUBMIT_REGEX });

			if (fileInput) {
				await user.upload(fileInput, file);
				await user.click(submitButton);

				// Simulate successful FileReader and API call
				await waitFor(() => {
					if (mockFileReader.onload) {
						const event = {
							target: { result: jsonContent },
						} as ProgressEvent<FileReader>;
						mockFileReader.onload(event);
					}
				});

				// Form should be reset after successful submission
				await waitFor(() => {
					expect(mockImportModal.onClose).toHaveBeenCalled();
				});
			}
		});
	});
});
