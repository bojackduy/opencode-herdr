import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type PluginConfig = {
  splits: boolean
  autoClose: boolean
  direction: "right" | "down"
}

const defaults: PluginConfig = {
  splits: true,
  autoClose: true,
  direction: "right",
}

const VALID_DIRECTIONS = new Set<string>(["right", "down"])

const PLUGIN_NAME = "opencode-herdr-control"
const LEGACY_NAME = "opencode-herdr"

function parseConfig(raw: string): PluginConfig | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn(`${PLUGIN_NAME}: Invalid config file, using defaults`)
    return { ...defaults }
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.warn(`${PLUGIN_NAME}: Invalid config file, using defaults`)
    return { ...defaults }
  }

  const obj = parsed as Record<string, unknown>
  const config: PluginConfig = { ...defaults }

  if ("splits" in obj && typeof obj.splits === "boolean") {
    config.splits = obj.splits
  }

  if ("autoClose" in obj && typeof obj.autoClose === "boolean") {
    config.autoClose = obj.autoClose
  }

  if ("direction" in obj && typeof obj.direction === "string" && VALID_DIRECTIONS.has(obj.direction)) {
    config.direction = obj.direction as "right" | "down"
  }

  return config
}

export function loadConfig(): PluginConfig {
  const configDir = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode")

  for (const name of [`${PLUGIN_NAME}.json`, `${LEGACY_NAME}.json`]) {
    try {
      const raw = readFileSync(join(configDir, name), "utf-8")
      const config = parseConfig(raw)
      if (config) return config
    } catch {
      // try next path
    }
  }

  return { ...defaults }
}
