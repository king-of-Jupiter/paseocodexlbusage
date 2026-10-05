import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

// Host-scoped connection settings. Bearer token lives here (not in usage inputs),
// so token rotation via Settings applies without rediscovery.
export const config = defineSettings({
  id: "config",
  scope: "host",
  version: 1,
  schema: z.object({
    endpointUrl: z.string().trim().default(""),
    bearerToken: z.string().default(""),
  }),
});
