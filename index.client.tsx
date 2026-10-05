import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ConnectionSettings } from "./client/connection-settings.js";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({
    id: "connection",
    title: "Custom Usage",
    icon: "Settings",
    Component: ConnectionSettings,
  });
  client.addCommandCenterItem({
    id: "open-connection",
    title: "Настроить custom usage",
    icon: "Settings",
    keywords: ["usage", "лимит", "токен", "custom"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("connection");
    },
  });
  return () => {};
}
