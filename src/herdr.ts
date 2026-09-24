import { execSync } from "node:child_process";

/**
 * Check if we're running inside a herdr environment.
 */
export function isInHerdr(): boolean {
  return process.env.HERDR_ENV === "1";
}

/**
 * Get the current pane ID.
 * First checks HERDR_PANE_ID env var, then falls back to `herdr pane list --json`.
 */
export async function getCurrentPaneId($: any): Promise<string | null> {
  if (process.env.HERDR_PANE_ID) {
    return process.env.HERDR_PANE_ID;
  }

  try {
    const result = await $`herdr pane list --json`.quiet().nothrow();
    const text = result.text?.() ?? result.stdout?.toString() ?? String(result);
    if (!text) return null;

    const parsed = JSON.parse(text);
    const focused = parsed?.panes?.find((p: any) => p.focused === true);
    return focused?.pane_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Split a pane in the given direction and return the new pane ID.
 */
export async function splitPane(
  $: any,
  direction: "right" | "down",
  fromPaneId: string
): Promise<string | null> {
  try {
    const result =
      $`herdr pane split ${fromPaneId} --direction ${direction} --no-focus`
        .quiet()
        .nothrow();
    const text = await result;
    const parsed = JSON.parse(text.toString());
    return parsed?.result?.pane?.pane_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Run a command in a specific pane. Fire and forget.
 * Accepts individual arguments for safe shell interpolation.
 */
export async function runInPane(
  $: any,
  paneId: string,
  ...commandParts: string[]
): Promise<void> {
  try {
    await $`herdr pane run ${paneId} ${commandParts}`.quiet().nothrow();
  } catch {
    // fire and forget
  }
}

/**
 * Close a pane. Silently ignores all errors.
 */
export async function closePane($: any, paneId: string): Promise<void> {
  try {
    await $`herdr pane close ${paneId}`.quiet().nothrow();
  } catch {
    // silently swallow all errors
  }
}

// Module-level memoization for resolveServerUrl
let _resolvedServerUrl: string | null | undefined = undefined;

/**
 * Resolve the OpenCode server URL.
 * Memoized — only resolves once, then returns the cached value.
 */
export function resolveServerUrl(): string | null {
  if (_resolvedServerUrl !== undefined) {
    return _resolvedServerUrl;
  }

  // Step 1: Check env var
  const envUrl = process.env.OPENCODE_SERVER_URL;
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.hostname === "0.0.0.0" || parsed.hostname === "[::]") {
        parsed.hostname = "localhost";
      }
      const url = parsed.toString().replace(/\/+$/, "");
      _resolvedServerUrl = url;
      return url;
    } catch {
      // Invalid URL, fall through
    }
  }

  // Step 2: Fall back to lsof
  try {
    const output = execSync(
      `lsof -nP -a -p ${process.pid} -iTCP -sTCP:LISTEN`,
      { encoding: "utf-8", timeout: 3000 }
    );
    const match = output.match(/:(\d+)\s+\(LISTEN\)/);
    if (match) {
      const url = `http://localhost:${match[1]}`;
      _resolvedServerUrl = url;
      return url;
    }
  } catch {
    // lsof failed, fall through
  }

  // Step 3: No URL available
  _resolvedServerUrl = null;
  console.warn(
    "opencode-herdr-control: Could not resolve OpenCode server URL. Splits will be disabled. Start OpenCode with --port flag."
  );
  return null;
}
