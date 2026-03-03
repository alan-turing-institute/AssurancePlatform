import { z } from "zod";

/**
 * Schema for validating OAuth provider input
 */
export const ProviderSchema = z.enum(["github", "google"]);

export type Provider = z.infer<typeof ProviderSchema>;
