import { z } from "zod";

// Inputs name credential stores, never credentials themselves.
// Auth lives in host settings (shared/config.ts), so the input is an empty marker.
export const inputSchema = z.object({}).strict();

export type UsageInput = z.infer<typeof inputSchema>;
