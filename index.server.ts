import type { PluginServerContext } from "@getpaseo/plugin/server";
import { hashAccountKey } from "@getpaseo/plugin/server/usage";
import { config } from "./shared/config.js";
import { inputSchema } from "./shared/input.js";
import { fetchCustomUsage } from "./server/usage.js";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(config);

  async function readConnection(): Promise<{ endpointUrl: string; bearerToken: string } | null> {
    const state = await settings.read();
    if (state.status !== "ready") return null;
    const endpointUrl = state.values.endpointUrl.trim();
    const bearerToken = state.values.bearerToken.trim();
    if (!endpointUrl || !bearerToken) return null;
    return { endpointUrl, bearerToken };
  }

  server.registerUsageSource({
    id: "custom-usage",
    label: "CodexLB",
    icon: "icon.svg",
    input: inputSchema,
    discover: async (scope) => {
      // Custom endpoint has no per-session login store; it is a single global account.
      if (scope.kind !== "global") return [];
      const connection = await readConnection();
      if (!connection) return [];
      return [
        {
          key: hashAccountKey(connection.endpointUrl),
          label: "CodexLB",
          input: {},
        },
      ];
    },
    fetch: async (value) => {
      inputSchema.parse(value);
      const connection = await readConnection();
      if (!connection) {
        throw new Error(
          "Custom usage endpoint is not configured. Open Settings → Plugins → CodexLB and set URL and Bearer token.",
        );
      }
      return fetchCustomUsage(connection.endpointUrl, connection.bearerToken);
    },
  });

  return () => {};
}
