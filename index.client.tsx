import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ConnectionSettings } from "./client/connection-settings.js";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "connection",
    title: "CodexLB",
    icon: "Settings",
    Component: ConnectionSettings,
  });
  client.addCommandCenterItem({
    id: "open-connection",
    title: "Configure CodexLB",
    icon: "Settings",
    keywords: ["usage", "limit", "token", "codexlb"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("connection");
    },
  });
  return () => {};
}
