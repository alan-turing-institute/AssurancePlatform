// stub: replaced by the key-storage slice
export function readUserApiKey(_userId: string): Promise<string | null> {
	return Promise.resolve(process.env.ASSISTANT_DEV_API_KEY ?? null);
}
