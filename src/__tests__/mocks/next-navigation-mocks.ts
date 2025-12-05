import { vi } from "vitest";

// Create mock functions that can be imported and manipulated in tests
export const mockPush = vi.fn();
export const mockReplace = vi.fn();
export const mockBack = vi.fn();
export const mockForward = vi.fn();
export const mockRefresh = vi.fn();
export const mockPrefetch = vi.fn();

export const mockRouter = {
	push: mockPush,
	replace: mockReplace,
	back: mockBack,
	forward: mockForward,
	refresh: mockRefresh,
	prefetch: mockPrefetch,
};

export const mockUseRouter = vi.fn(() => mockRouter);
export const mockUsePathname = vi.fn(() => "/");
export const mockUseSearchParams = vi.fn(() => new URLSearchParams());
export const mockUseParams = vi.fn(() => ({}));
export const mockNotFound = vi.fn(() => {
	throw new Error("NEXT_NOT_FOUND");
});

// Helper to reset all navigation mocks
export const resetNavigationMocks = () => {
	mockPush.mockClear();
	mockReplace.mockClear();
	mockBack.mockClear();
	mockForward.mockClear();
	mockRefresh.mockClear();
	mockPrefetch.mockClear();
	mockUseRouter.mockClear();
	mockUsePathname.mockClear();
	mockUseSearchParams.mockClear();
	mockUseParams.mockClear();
	mockNotFound.mockClear();

	// Reset return values to defaults
	mockUseRouter.mockReturnValue(mockRouter);
	mockUsePathname.mockReturnValue("/");
	mockUseSearchParams.mockReturnValue(new URLSearchParams());
	mockUseParams.mockReturnValue({});
};

// Helper to set custom router values
export const setMockRouterValues = (values: Partial<typeof mockRouter>) => {
	Object.assign(mockRouter, values);
};

// Helper to set pathname
export const setMockPathname = (pathname: string) => {
	mockUsePathname.mockReturnValue(pathname);
};

// Helper to set search params
export const setMockSearchParams = (params: Record<string, string>) => {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(params));
};

// Helper to set params
export const setMockParams = (params: Record<string, string>) => {
	mockUseParams.mockReturnValue(params);
};
