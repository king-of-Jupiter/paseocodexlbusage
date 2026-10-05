import {
  toneFromUsedPct,
  usedPctOf,
  windowFromReportedDuration,
  windowFromUsedPct,
  type UsageReport,
  type UsageWindow,
} from "@getpaseo/plugin/server/usage";
import { z } from "zod";

const ApiNumberSchema = z.coerce.number().finite().nullish();

const LimitSchema = z.object({
  limit_type: z.string().nullish(),
  limit_window: z.string(),
  max_value: ApiNumberSchema,
  current_value: ApiNumberSchema,
  remaining_value: ApiNumberSchema,
  model_filter: z.string().nullish(),
  reset_at: z.string().nullish(),
});

const CustomUsageResponseSchema = z.object({
  request_count: ApiNumberSchema,
  total_tokens: ApiNumberSchema,
  cached_input_tokens: ApiNumberSchema,
  total_cost_usd: ApiNumberSchema,
  limits: z.array(LimitSchema).nullish(),
  upstream_limits: z.array(LimitSchema).nullish(),
  account_pool_usage: z
    .object({
      primary: ApiNumberSchema,
      secondary: ApiNumberSchema,
    })
    .nullish(),
});

type CustomLimit = z.infer<typeof LimitSchema>;
type CustomUsageResponse = z.infer<typeof CustomUsageResponseSchema>;

const WINDOW_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** "5h" -> 18000, "7d" -> 604800. Null when the provider string is not a plain duration. */
export function parseWindowSeconds(window: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([smhdw])\s*$/i.exec(window);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = WINDOW_SECONDS[(match[2] ?? "").toLowerCase()];
  if (!Number.isFinite(amount) || unit === undefined || amount <= 0) return null;
  return Math.round(amount * unit);
}

function usedFromLimit(limit: CustomLimit): number | null {
  if (typeof limit.current_value === "number") return limit.current_value;
  if (typeof limit.max_value === "number" && typeof limit.remaining_value === "number") {
    return limit.max_value - limit.remaining_value;
  }
  return null;
}

function resetsAtFromLimit(limit: CustomLimit): string | null {
  if (typeof limit.reset_at !== "string" || limit.reset_at.length === 0) return null;
  return Number.isNaN(Date.parse(limit.reset_at)) ? null : limit.reset_at;
}

function normalizeScopeId(name: string): string {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return id || "filtered";
}

function normalizeWindowBase(window: string): string {
  const base = window
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "limit";
}

function limitToWindow(limit: CustomLimit): UsageWindow {
  const used = usedFromLimit(limit);
  const usedPct = usedPctOf(used, limit.max_value ?? null);
  const resetsAt = resetsAtFromLimit(limit);
  const tone = toneFromUsedPct(usedPct);
  const modelFilter = limit.model_filter?.trim() || null;
  const scope = modelFilter
    ? { id: normalizeScopeId(modelFilter), label: modelFilter }
    : undefined;
  const durationSeconds = parseWindowSeconds(limit.limit_window);

  if (durationSeconds !== null) {
    return windowFromReportedDuration({
      durationSeconds,
      ...(scope ? { scope } : {}),
      unknown: { id: "rolling", label: "Rolling", shortLabel: "" },
      utilizationPct: usedPct,
      resetsAt,
      summary: true,
      tone,
    });
  }

  // Provider string is not a plain duration: use it verbatim as the provider's period name.
  const base = normalizeWindowBase(limit.limit_window);
  return windowFromUsedPct({
    id: scope ? `${scope.id}:${base}` : `credits_${base}`,
    label: scope ? `${scope.label} · ${limit.limit_window}` : limit.limit_window,
    shortLabel: limit.limit_window,
    summary: true,
    utilizationPct: usedPct,
    resetsAt,
    tone,
  });
}

function uniqueId(candidate: string, taken: Set<string>): string {
  if (!taken.has(candidate)) return candidate;
  for (let suffix = 2; ; suffix += 1) {
    const next = `${candidate}_${suffix}`;
    if (!taken.has(next)) return next;
  }
}

export function buildReport(data: CustomUsageResponse): UsageReport {
  const limits =
    data.limits && data.limits.length > 0
      ? data.limits
      : data.upstream_limits && data.upstream_limits.length > 0
        ? data.upstream_limits
        : [];

  if (limits.length === 0) {
    return { status: "error", error: "Endpoint returned no limits[] entries to display." };
  }

  const taken = new Set<string>();
  const windows: UsageWindow[] = limits.map((limit) => {
    const window = limitToWindow(limit);
    const id = uniqueId(window.id, taken);
    taken.add(id);
    return id === window.id ? window : { ...window, id };
  });

  return {
    status: "available",
    windows,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchCustomUsage(
  endpointUrl: string,
  bearerToken: string,
  fetchFn: typeof fetch = fetch,
): Promise<UsageReport> {
  const url = endpointUrl.trim();
  const token = bearerToken.trim();
  if (!url) {
    return { status: "error", error: "Custom usage endpoint URL is not configured." };
  }
  if (!isHttpUrl(url)) {
    return { status: "error", error: "Custom usage endpoint URL must be an absolute http(s) URL." };
  }
  if (!token) {
    return { status: "error", error: "Bearer token is not configured." };
  }

  let res: Response;
  try {
    res = await fetchFn(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", error: `Custom usage request failed: ${message}` };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: "unavailable", problem: { kind: "rejected", status: res.status } };
  }
  if (!res.ok) {
    return { status: "error", error: `Custom usage endpoint returned HTTP ${res.status}.` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { status: "error", error: "Custom usage endpoint returned invalid JSON." };
  }

  const parsed = CustomUsageResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { status: "error", error: "Custom usage endpoint returned an unexpected JSON shape." };
  }

  return buildReport(parsed.data);
}
