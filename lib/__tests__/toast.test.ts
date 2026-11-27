import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/toast");

const sonner = vi.hoisted(() => {
	const base = vi.fn();
	return Object.assign(base, {
		error: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
	});
});

vi.mock("sonner", () => ({ toast: sonner }));

import { toast, toastError, toastInfo, toastSuccess } from "@/lib/toast";

type Variant = "default" | "destructive" | "success";

function resetSonner() {
	sonner.mockReset();
	sonner.error.mockReset();
	sonner.success.mockReset();
	sonner.info.mockReset();
}

/** The one sonner function a variant must reach, and the ones it must not. */
function targetFor(variant: Variant) {
	if (variant === "destructive") {
		return sonner.error;
	}
	if (variant === "success") {
		return sonner.success;
	}
	return sonner;
}

function othersFor(variant: Variant) {
	const all = [sonner, sonner.error, sonner.success, sonner.info];
	const target = targetFor(variant);
	return all.filter((fn) => fn !== target);
}

describe("toast", () => {
	beforeEach(resetSonner);
	afterEach(resetSonner);

	describe.each([
		"default",
		"destructive",
		"success",
	] as const)("variant %s", (variant) => {
		it("shows the title with the description as details when both are given", () => {
			toast({ variant, title: "Saved", description: "Case updated" });

			const target = targetFor(variant);
			expect(target).toHaveBeenCalledTimes(1);
			expect(target.mock.calls[0]?.[0]).toBe("Saved");
			expect(target.mock.calls[0]?.[1]).toStrictEqual({
				description: "Case updated",
			});
			for (const other of othersFor(variant)) {
				expect(other).not.toHaveBeenCalled();
			}
		});

		it("shows a title alone with no details", () => {
			toast({ variant, title: "Saved" });

			const target = targetFor(variant);
			expect(target.mock.calls[0]?.[0]).toBe("Saved");
			expect(target.mock.calls[0]?.[1]).toStrictEqual({
				description: undefined,
			});
		});

		it("uses a description given without a title as the message, with no details", () => {
			toast({ variant, description: "Only details" });

			const target = targetFor(variant);
			expect(target.mock.calls[0]?.[0]).toBe("Only details");
			expect(target.mock.calls[0]?.[1]).toStrictEqual({
				description: undefined,
			});
		});

		it("uses an empty title as absent", () => {
			toast({ variant, title: "", description: "Fallback text" });

			const target = targetFor(variant);
			expect(target.mock.calls[0]?.[0]).toBe("Fallback text");
			expect(target.mock.calls[0]?.[1]).toStrictEqual({
				description: undefined,
			});
		});

		it("shows an empty message when neither title nor description is given", () => {
			toast({ variant });

			const target = targetFor(variant);
			expect(target.mock.calls[0]?.[0]).toBe("");
			expect(target.mock.calls[0]?.[1]).toStrictEqual({
				description: undefined,
			});
		});
	});

	it("shows the plain style when no variant is given", () => {
		toast({ title: "Hello", description: "World" });

		expect(sonner).toHaveBeenCalledTimes(1);
		expect(sonner.mock.calls[0]?.[0]).toBe("Hello");
		expect(sonner.mock.calls[0]?.[1]).toStrictEqual({ description: "World" });
		expect(sonner.error).not.toHaveBeenCalled();
		expect(sonner.success).not.toHaveBeenCalled();
	});
});

describe("toastError and toastSuccess", () => {
	beforeEach(resetSonner);
	afterEach(resetSonner);

	it("toastError passes the message and description to the error toast only", () => {
		toastError("Failed", "Try again");

		expect(sonner.error).toHaveBeenCalledTimes(1);
		expect(sonner.error.mock.calls[0]?.[0]).toBe("Failed");
		expect(sonner.error.mock.calls[0]?.[1]).toStrictEqual({
			description: "Try again",
		});
		expect(sonner.success).not.toHaveBeenCalled();
		expect(sonner).not.toHaveBeenCalled();
	});

	it("toastSuccess passes the message and description to the success toast only", () => {
		toastSuccess("Done", "All good");

		expect(sonner.success).toHaveBeenCalledTimes(1);
		expect(sonner.success.mock.calls[0]?.[0]).toBe("Done");
		expect(sonner.success.mock.calls[0]?.[1]).toStrictEqual({
			description: "All good",
		});
		expect(sonner.error).not.toHaveBeenCalled();
		expect(sonner).not.toHaveBeenCalled();
	});

	it("passes an absent description on as undefined", () => {
		toastError("Failed");
		toastSuccess("Done");

		expect(sonner.error.mock.calls[0]?.[1]).toStrictEqual({
			description: undefined,
		});
		expect(sonner.success.mock.calls[0]?.[1]).toStrictEqual({
			description: undefined,
		});
	});
});

describe("toastInfo", () => {
	beforeEach(resetSonner);
	afterEach(resetSonner);

	it("passes the message and the options, including the duration, to the info toast", () => {
		toastInfo("Heads up", { duration: 7000 });

		expect(sonner.info).toHaveBeenCalledTimes(1);
		expect(sonner.info.mock.calls[0]?.[0]).toBe("Heads up");
		expect(sonner.info.mock.calls[0]?.[1]).toStrictEqual({ duration: 7000 });
		expect(sonner.error).not.toHaveBeenCalled();
		expect(sonner.success).not.toHaveBeenCalled();
	});

	it("passes no options when none are given", () => {
		toastInfo("Heads up");

		expect(sonner.info).toHaveBeenCalledTimes(1);
		expect(sonner.info.mock.calls[0]?.[1]).toBeUndefined();
	});
});
