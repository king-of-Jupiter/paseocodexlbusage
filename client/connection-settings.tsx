import { useMemo, useState } from "react";
import { Text } from "react-native";
import {
  useSettings,
  type PluginSurfaceProps,
  type SettingsState,
} from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
} from "@getpaseo/plugin/client/ui";
import { config } from "../shared/config.js";

type ReadySettings = Extract<
  SettingsState<typeof config.schema>,
  { status: "ready" }
>;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value.trim());
}

function ConnectionForm({
  settings,
  textColor,
  hintColor,
}: {
  settings: ReadySettings;
  textColor: { color: string };
  hintColor: { color: string };
}) {
  const [url, setUrl] = useState(settings.values.endpointUrl);
  const [token, setToken] = useState(settings.values.bearerToken);

  const urlError = url.trim() && !isHttpUrl(url) ? "Enter an absolute http(s) URL" : null;
  const dirty =
    url !== settings.values.endpointUrl || token !== settings.values.bearerToken;

  async function save() {
    if (urlError) return;
    await settings.save(
      { endpointUrl: url.trim(), bearerToken: token.trim() },
      settings.revision,
    );
  }

  async function discard() {
    setUrl(settings.values.endpointUrl);
    setToken(settings.values.bearerToken);
    await settings.reload();
  }

  return (
    <SettingsSection title="Usage source">
      <SettingsCard>
        <SettingsInput
          label="Endpoint URL"
          hint="GET, returns JSON with limits[] (5h / 7d)"
          placeholder="https://example.com/api/usage"
          initialValue={url}
          onChangeText={setUrl}
          disabled={settings.saving}
          error={urlError}
        />
        <SettingsInput
          label="Bearer token"
          hint="Sent as Authorization: Bearer ..."
          placeholder="paste token"
          initialValue={token}
          onChangeText={setToken}
          disabled={settings.saving}
          secureTextEntry
        />
        <SettingsAction
          label="Connection"
          hint="Saves the URL and token on this host"
          actionLabel={settings.saving ? "Saving…" : "Save"}
          disabled={settings.saving || !!urlError}
          onPress={save}
        />
        {dirty ? (
          <SettingsAction
            label="Unsaved changes"
            actionLabel="Discard"
            disabled={settings.saving}
            onPress={discard}
          />
        ) : null}
        <SettingsAction
          label="Defaults"
          hint="Clears the URL and token; the card disappears from Usage"
          actionLabel="Reset"
          disabled={settings.saving}
          onPress={() => settings.reset()}
        />
      </SettingsCard>
      {settings.saveError ? (
        <Text accessibilityRole="alert" style={textColor}>
          {settings.saveError}
        </Text>
      ) : null}
      <Text style={hintColor}>
        After saving, open Usage and press Refresh. The 5h and 7d windows should appear. Empty
        URL and token disable the source.
      </Text>
    </SettingsSection>
  );
}

export function ConnectionSettings({ theme }: PluginSurfaceProps) {
  const settings = useSettings(config);
  const styles = useMemo(
    () => ({
      text: { color: theme.colors.foreground },
      hint: { color: theme.colors.foregroundMuted },
    }),
    [theme],
  );

  if (settings.status === "loading") {
    return <Text style={styles.text}>Loading settings…</Text>;
  }

  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Usage source">
        <Text style={styles.text}>{settings.error}</Text>
        <SettingsAction label="Retry" actionLabel="Reload" onPress={settings.reload} />
        {settings.status === "invalid" ? (
          <SettingsAction
            label="Restore empty values"
            actionLabel="Reset"
            onPress={settings.reset}
          />
        ) : null}
      </SettingsSection>
    );
  }

  return (
    <ConnectionForm settings={settings} textColor={styles.text} hintColor={styles.hint} />
  );
}
