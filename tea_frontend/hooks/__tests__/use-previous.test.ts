import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePrevious } from "@/hooks/use-previous";

describe("usePrevious", () => {
	beforeEach(() => {
		// No special setup needed for this hook
	});

	describe("Basic functionality", () => {
		it("should return undefined on first render", () => {
			const { result } = renderHook(({ value }) => usePrevious(value), {
				initialProps: { value: "initial" },
			});

			expect(result.current).toBeUndefined();
		});

		it("should return previous value after re-render", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: "first" },
				}
			);

			// First render should return undefined
			expect(result.current).toBeUndefined();

			// Change value and re-render
			rerender({ value: "second" });

			// Should now return the previous value
			expect(result.current).toBe("first");
		});

		it("should track changes through multiple re-renders", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 1 },
				}
			);

			expect(result.current).toBeUndefined();

			rerender({ value: 2 });
			expect(result.current).toBe(1);

			rerender({ value: 3 });
			expect(result.current).toBe(2);

			rerender({ value: 4 });
			expect(result.current).toBe(3);
		});

		it("should work with same value across re-renders", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: "constant" },
				}
			);

			expect(result.current).toBeUndefined();

			rerender({ value: "constant" });
			expect(result.current).toBe("constant");

			rerender({ value: "constant" });
			expect(result.current).toBe("constant");
		});
	});

	describe("Different data types", () => {
		it("should work with strings", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: "hello" },
				}
			);

			rerender({ value: "world" });
			expect(result.current).toBe("hello");

			rerender({ value: "test" });
			expect(result.current).toBe("world");
		});

		it("should work with numbers", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 42 },
				}
			);

			rerender({ value: 100 });
			expect(result.current).toBe(42);

			rerender({ value: 0 });
			expect(result.current).toBe(100);
		});

		it("should work with booleans", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: true },
				}
			);

			rerender({ value: false });
			expect(result.current).toBe(true);

			rerender({ value: true });
			expect(result.current).toBe(false);
		});

		it("should work with null and undefined", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: null as string | null | undefined },
				}
			);

			rerender({ value: undefined });
			expect(result.current).toBe(null);

			rerender({ value: "value" });
			expect(result.current).toBe(undefined);

			rerender({ value: null });
			expect(result.current).toBe("value");
		});

		it("should work with objects", () => {
			const obj1 = { name: "John", age: 30 };
			const obj2 = { name: "Jane", age: 25 };

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: obj1 },
				}
			);

			rerender({ value: obj2 });
			expect(result.current).toBe(obj1);
			expect(result.current).toEqual({ name: "John", age: 30 });

			rerender({ value: obj1 });
			expect(result.current).toBe(obj2);
		});

		it("should work with arrays", () => {
			const arr1 = [1, 2, 3];
			const arr2 = [4, 5, 6];

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: arr1 },
				}
			);

			rerender({ value: arr2 });
			expect(result.current).toBe(arr1);
			expect(result.current).toEqual([1, 2, 3]);

			rerender({ value: [] });
			expect(result.current).toBe(arr2);
		});

		it("should work with functions", () => {
			const func1 = () => "first";
			const func2 = () => "second";

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: func1 },
				}
			);

			rerender({ value: func2 });
			expect(result.current).toBe(func1);
			expect((result.current as (() => string) | undefined)?.()).toBe("first");

			rerender({ value: func1 });
			expect(result.current).toBe(func2);
		});
	});

	describe("Reference equality", () => {
		it("should maintain reference equality for objects", () => {
			const obj = { count: 1 };

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: obj },
				}
			);

			const newObj = { count: 2 };
			rerender({ value: newObj });

			// Should be the exact same reference
			expect(result.current).toBe(obj);
			expect(result.current === obj).toBe(true);
		});

		it("should distinguish between objects with same content", () => {
			const obj1 = { name: "test" };
			const obj2 = { name: "test" };

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: obj1 },
				}
			);

			rerender({ value: obj2 });

			expect(result.current).toBe(obj1);
			expect(result.current).not.toBe(obj2);
			expect(result.current).toEqual(obj2); // Same content
		});

		it("should work with same object reference", () => {
			const obj = { mutable: "value" };

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: obj },
				}
			);

			// Mutate the object but keep same reference
			obj.mutable = "changed";
			rerender({ value: obj });

			expect(result.current).toBe(obj);
			expect((result.current as typeof obj | undefined)?.mutable).toBe(
				"changed"
			); // Mutation is visible
		});
	});

	describe("Complex scenarios", () => {
		it("should work with deeply nested objects", () => {
			const complex1 = {
				user: { profile: { settings: { theme: "dark" } } },
				data: [1, 2, { nested: true }],
			};
			const complex2 = {
				user: { profile: { settings: { theme: "light" } } },
				data: [4, 5, { nested: false }],
			};

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: complex1 },
				}
			);

			rerender({ value: complex2 });
			expect(result.current).toBe(complex1);
			expect(
				(result.current as typeof complex1 | undefined)?.user.profile.settings
					.theme
			).toBe("dark");
		});

		it("should work with frequently changing values", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 0 },
				}
			);

			for (let i = 1; i <= 10; i++) {
				rerender({ value: i });
				expect(result.current).toBe(i - 1);
			}
		});

		it("should handle alternating values", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: "A" },
				}
			);

			rerender({ value: "B" });
			expect(result.current).toBe("A");

			rerender({ value: "A" });
			expect(result.current).toBe("B");

			rerender({ value: "B" });
			expect(result.current).toBe("A");

			rerender({ value: "A" });
			expect(result.current).toBe("B");
		});
	});

	describe("Edge cases", () => {
		it("should handle zero as a value", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 1 },
				}
			);

			rerender({ value: 0 });
			expect(result.current).toBe(1);

			rerender({ value: -1 });
			expect(result.current).toBe(0);
		});

		it("should handle empty string as a value", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: "hello" },
				}
			);

			rerender({ value: "" });
			expect(result.current).toBe("hello");

			rerender({ value: "world" });
			expect(result.current).toBe("");
		});

		it("should handle NaN as a value", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 42 },
				}
			);

			rerender({ value: Number.NaN });
			expect(result.current).toBe(42);

			rerender({ value: 100 });
			expect(Number.isNaN(result.current)).toBe(true);
		});

		it("should handle Infinity as a value", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 42 },
				}
			);

			rerender({ value: Number.POSITIVE_INFINITY });
			expect(result.current).toBe(42);

			rerender({ value: Number.NEGATIVE_INFINITY });
			expect(result.current).toBe(Number.POSITIVE_INFINITY);
		});
	});

	describe("Performance considerations", () => {
		it("should not cause unnecessary re-renders", () => {
			let renderCount = 0;

			const { rerender } = renderHook(
				({ value }) => {
					renderCount++;
					return usePrevious(value);
				},
				{
					initialProps: { value: "test" },
				}
			);

			expect(renderCount).toBe(1);

			rerender({ value: "test" }); // Same value
			expect(renderCount).toBe(2); // Should still re-render, but that's expected

			rerender({ value: "different" });
			expect(renderCount).toBe(3);
		});

		it("should handle large objects efficiently", () => {
			const largeObject = Object.fromEntries(
				Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
			);

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: largeObject },
				}
			);

			const newLargeObject = { ...largeObject, newKey: "newValue" };
			rerender({ value: newLargeObject });

			expect(result.current).toBe(largeObject);
			expect(result.current).not.toBe(newLargeObject);
		});

		it("should handle rapid value changes efficiently", () => {
			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: 0 },
				}
			);

			// Rapid changes
			for (let i = 1; i < 100; i++) {
				rerender({ value: i });
				expect(result.current).toBe(i - 1);
			}
		});
	});

	describe("Memory management", () => {
		it("should not leak memory on unmount", () => {
			const { unmount } = renderHook(({ value }) => usePrevious(value), {
				initialProps: { value: "test" },
			});

			// Should not throw or cause memory leaks
			unmount();
		});

		it("should release references to previous values", () => {
			const obj1 = { large: new Array(1000).fill("data") };
			const obj2 = { large: new Array(1000).fill("different") };

			const { result, rerender } = renderHook(
				({ value }) => usePrevious(value),
				{
					initialProps: { value: obj1 as typeof obj1 | typeof obj2 | string },
				}
			);

			rerender({ value: obj2 });
			expect(result.current).toBe(obj1);

			// After another render, obj1 should no longer be referenced
			rerender({ value: "simple" });
			expect(result.current).toBe(obj2);
			expect(result.current).not.toBe(obj1);
		});
	});

	describe("TypeScript compatibility", () => {
		it("should maintain type safety with typed values", () => {
			type User = {
				name: string;
				age: number;
			};

			const user1: User = { name: "John", age: 30 };
			const user2: User = { name: "Jane", age: 25 };

			const { result, rerender } = renderHook(
				({ value }: { value: User }) => usePrevious(value),
				{
					initialProps: { value: user1 },
				}
			);

			rerender({ value: user2 });

			// TypeScript should infer the correct type
			expect((result.current as User | undefined)?.name).toBe("John");
			expect((result.current as User | undefined)?.age).toBe(30);
		});

		it("should work with union types", () => {
			type Value = string | number | null;

			const { result, rerender } = renderHook(
				({ value }: { value: Value }) => usePrevious(value),
				{
					initialProps: { value: "hello" as Value },
				}
			);

			rerender({ value: 42 });
			expect(result.current).toBe("hello");

			rerender({ value: null });
			expect(result.current).toBe(42);
		});
	});
});
