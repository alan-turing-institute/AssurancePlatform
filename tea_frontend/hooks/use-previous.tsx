import { useEffect, useRef } from "react";

/**
 * Custom hook that stores the previous value of a given variable.
 *
 * This hook allows you to capture the previous value of a prop or state variable in a functional component.
 * On every render, it updates the reference with the current value but returns the value from the previous render.
 *
 * @param {T} value - The current value to track and store the previous version of.
 * @returns {T | undefined} The previous value of the input variable.
 *
 * @example
 * function MyComponent({ prop }) {
 *   const prevProp = usePrevious(prop);
 *   console.log('Current prop:', prop);
 *   console.log('Previous prop:', prevProp);
 *   return <div>{prop}</div>;
 * }
 */
export function usePrevious<T>(value: T): T | undefined {
	const ref = useRef<T>();

	useEffect(() => {
		ref.current = value;
	}, [value]);

	return ref.current;
}
