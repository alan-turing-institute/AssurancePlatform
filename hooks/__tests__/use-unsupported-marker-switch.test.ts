import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, saveMock, toastMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
	saveMock: vi.fn(),
	toastMock: vi.fn(),
}));

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: fetchMock,
	saveShowUnsupportedMarkers: saveMock,
}));
vi.mock("@/lib/toast", () => ({ toast: toastMock }));

import { useUnsupportedMarkerSwitch } from "../use-unsupported-marker-switch";

/** The switch with the value held in state, as the toolbar (store) and the Settings page (local state) hold it. */
function useHeld(initial: boolean | null) {
	const [value, setValue] = useState<boolean | null>(initial);
	return { value, ...useUnsupportedMarkerSwitch(value, setValue) };
}

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

beforeEach(() => {
	fetchMock.mockReset();
	// The stored value cannot be read, unless a test says otherwise, so a failed save falls back on the last value known to be stored.
	fetchMock.mockResolvedValue(null);
	saveMock.mockReset();
	toastMock.mockReset();
});

describe("useUnsupportedMarkerSwitch", () => {
	it("changes the held value first, then saves it", async () => {
		const save = deferred<boolean | null>();
		saveMock.mockReturnValue(save.promise);
		const { result } = renderHook(() => useHeld(true));

		act(() => {
			result.current.onCheckedChange(false);
		});

		expect(result.current.value).toBe(false);
		expect(result.current.checked).toBe(false);
		expect(saveMock).toHaveBeenCalledWith(false);

		await act(async () => save.resolve(false));

		expect(result.current.value).toBe(false);
		expect(toastMock).not.toHaveBeenCalled();
	});

	it("puts the old value back, with a message, when the save fails", async () => {
		saveMock.mockResolvedValue(null);
		const { result } = renderHook(() => useHeld(true));

		await act(async () => {
			await result.current.onCheckedChange(false);
		});

		expect(result.current.value).toBe(true);
		expect(toastMock).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "destructive" })
		);
	});

	it("puts the old value back when the save throws", async () => {
		saveMock.mockRejectedValue(new Error("network"));
		const { result } = renderHook(() => useHeld(false));

		await act(async () => {
			await result.current.onCheckedChange(true);
		});

		expect(result.current.value).toBe(false);
		expect(toastMock).toHaveBeenCalledTimes(1);
	});

	it("keeps the choice when the save was stored and only its reply was lost", async () => {
		saveMock.mockRejectedValue(new Error("connection lost"));
		fetchMock.mockResolvedValue(false);
		const { result } = renderHook(() => useHeld(true));

		await act(async () => {
			await result.current.onCheckedChange(false);
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.current.value).toBe(false);
		expect(toastMock).not.toHaveBeenCalled();
	});

	it("puts the old value back when the stored value cannot be read either", async () => {
		saveMock.mockResolvedValue(null);
		fetchMock.mockRejectedValue(new Error("offline"));
		const { result } = renderHook(() => useHeld(true));

		await act(async () => {
			await result.current.onCheckedChange(false);
		});

		expect(result.current.value).toBe(true);
		expect(toastMock).toHaveBeenCalledTimes(1);
	});

	it("ignores a read of the stored value that a later press has overtaken", async () => {
		const read = deferred<boolean | null>();
		fetchMock.mockReturnValue(read.promise);
		saveMock.mockResolvedValueOnce(null).mockResolvedValueOnce(true);
		const { result } = renderHook(() => useHeld(true));

		act(() => {
			result.current.onCheckedChange(false);
		});
		await act(async () => undefined);
		await act(async () => {
			await result.current.onCheckedChange(true);
		});
		await act(async () => read.resolve(false));

		expect(result.current.value).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(toastMock).not.toHaveBeenCalled();
	});

	it("cannot be pressed while the setting has not loaded", async () => {
		const { result } = renderHook(() => useHeld(null));

		expect(result.current.disabled).toBe(true);
		expect(result.current.checked).toBe(false);

		await act(async () => {
			await result.current.onCheckedChange(true);
		});

		expect(saveMock).not.toHaveBeenCalled();
		expect(result.current.value).toBeNull();
	});

	it("does not save a value the switch already has", async () => {
		const { result } = renderHook(() => useHeld(true));

		await act(async () => {
			await result.current.onCheckedChange(true);
		});

		expect(saveMock).not.toHaveBeenCalled();
	});

	it("lets a later choice stand when an earlier save fails after it", async () => {
		const first = deferred<boolean | null>();
		saveMock.mockReturnValueOnce(first.promise);
		saveMock.mockResolvedValueOnce(true);
		const { result } = renderHook(() => useHeld(true));

		act(() => {
			result.current.onCheckedChange(false);
		});
		await act(async () => {
			await result.current.onCheckedChange(true);
		});
		await act(async () => first.resolve(null));

		expect(result.current.value).toBe(true);
		expect(toastMock).not.toHaveBeenCalled();
	});
});
