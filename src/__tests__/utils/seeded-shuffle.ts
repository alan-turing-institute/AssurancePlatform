/**
 * A repeatable shuffle for tests that must give the same answer however a list
 * is ordered. The same seed always gives the same order, so a failure can be
 * run again.
 */

const MODULUS = 4_294_967_296;

function randomFrom(seed: number): () => number {
	let state = seed % MODULUS;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % MODULUS;
		return state / MODULUS;
	};
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
	const random = randomFrom(seed);
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const held = copy[i] as T;
		copy[i] = copy[j] as T;
		copy[j] = held;
	}
	return copy;
}

/** Every ordering of a short list, for tests that can afford them all. */
export function allOrders<T>(items: readonly T[]): T[][] {
	if (items.length <= 1) {
		return [[...items]];
	}
	const orders: T[][] = [];
	items.forEach((item, index) => {
		const rest = [...items.slice(0, index), ...items.slice(index + 1)];
		for (const tail of allOrders(rest)) {
			orders.push([item, ...tail]);
		}
	});
	return orders;
}
