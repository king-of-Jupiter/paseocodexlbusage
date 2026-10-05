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

  const urlError = url.trim() && !isHttpUrl(url) ? "Введите абсолютный http(s) URL" : null;
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
    <SettingsSection title="Источник usage">
      <SettingsCard>
        <SettingsInput
          label="Endpoint URL"
          hint="GET, возвращает JSON с limits[] (5h / 7d)"
          placeholder="https://example.com/api/usage"
          initialValue={url}
          onChangeText={setUrl}
          disabled={settings.saving}
          error={urlError}
        />
        <SettingsInput
          label="Bearer токен"
          hint="Отправляется как Authorization: Bearer ..."
          placeholder="вставьте токен"
          initialValue={token}
          onChangeText={setToken}
          disabled={settings.saving}
          secureTextEntry
        />
        <SettingsAction
          label="Подключение"
          hint="Сохраняет URL и токен на этом хосте"
          actionLabel={settings.saving ? "Сохранение…" : "Сохранить"}
          disabled={settings.saving || !!urlError}
          onPress={save}
        />
        {dirty ? (
          <SettingsAction
            label="Несохранённые изменения"
            actionLabel="Отменить"
            disabled={settings.saving}
            onPress={discard}
          />
        ) : null}
        <SettingsAction
          label="Значения по умолчанию"
          hint="Очищает URL и токен, карточка пропадёт из Использования"
          actionLabel="Сбросить"
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
        После сохранения откройте «Использование» и нажмите Refresh. Должны появиться окна 5h и
        7d. Пустые URL и токен отключают источник.
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
    return <Text style={styles.text}>Загрузка настроек…</Text>;
  }

  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Источник usage">
        <Text style={styles.text}>{settings.error}</Text>
        <SettingsAction label="Повторить" actionLabel="Обновить" onPress={settings.reload} />
        {settings.status === "invalid" ? (
          <SettingsAction
            label="Восстановить пустые значения"
            actionLabel="Сбросить"
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
