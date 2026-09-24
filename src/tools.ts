import { execFile } from "node:child_process"
import { tool } from "@opencode-ai/plugin"

function execHerdr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("herdr", args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr?.toString() || stdout?.toString() || err.message).trim()
        reject(new Error(msg || "herdr command failed"))
        return
      }
      resolve(stdout.toString().trim())
    })
  })
}

function execHerdrLong(args: string[], timeoutMs = 120000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("herdr", args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr?.toString() || stdout?.toString() || err.message).trim()
        reject(new Error(msg || "herdr command failed"))
        return
      }
      resolve(stdout.toString().trim())
    })
  })
}

function ensureInHerdr(): void {
  if (process.env.HERDR_ENV !== "1") {
    throw new Error("Not running inside Herdr (HERDR_ENV!=1). Herdr control tools only work when OpenCode runs inside a herdr pane.")
  }
}

export function createHerdrTools() {
  return {
    herdr_status: tool({
      description: "Survey current Herdr status. Returns workspaces, tabs in current workspace, panes in current workspace, agents, and sessions. Use this first to discover IDs before any other herdr action.",
      args: {},
      async execute() {
        ensureInHerdr()
        const [workspaces, tabs, panes, agents, sessions] = await Promise.all([
          execHerdr(["workspace", "list"]).catch((e) => `workspace list failed: ${e.message}`),
          execHerdr(["tab", "list", "--workspace", process.env.HERDR_WORKSPACE_ID ?? ""]).catch((e) => `tab list failed: ${e.message}`),
          execHerdr(["pane", "list", "--workspace", process.env.HERDR_WORKSPACE_ID ?? ""]).catch((e) => `pane list failed: ${e.message}`),
          execHerdr(["agent", "list"]).catch((e) => `agent list failed: ${e.message}`),
          execHerdr(["session", "list"]).catch((e) => `session list failed: ${e.message}`),
        ])
        return `WORKSPACES:\n${workspaces}\n\nTABS:\n${tabs}\n\nPANES:\n${panes}\n\nAGENTS:\n${agents}\n\nSESSIONS:\n${sessions}`
      },
    }),

    herdr_pane_list: tool({
      description: "List herdr panes. Defaults to current workspace. Returns JSON with pane_id, tab_id, cwd, agent_status.",
      args: {
        workspaceId: tool.schema.string().optional().describe("Workspace ID like w1G. Omit for current workspace."),
      },
      async execute(args) {
        ensureInHerdr()
        const ws = args.workspaceId ?? process.env.HERDR_WORKSPACE_ID
        const extra = ws ? ["--workspace", ws] : []
        return await execHerdr(["pane", "list", ...extra])
      },
    }),

    herdr_pane_split: tool({
      description: "Create a new herdr pane by splitting. Returns JSON with new pane_id at .result.pane.pane_id. Use direction right for wide panes, down for narrow/tall panes.",
      args: {
        direction: tool.schema.enum(["right", "down"]).describe("Split direction"),
        cwd: tool.schema.string().optional().describe("Working directory for new pane. Defaults to session directory."),
        focus: tool.schema.boolean().optional().describe("Focus new pane. Default false (keep focus)."),
      },
      async execute(args, ctx) {
        ensureInHerdr()
        const cwd = args.cwd ?? ctx.directory ?? process.cwd()
        const focusArgs = args.focus ? ["--focus"] : ["--no-focus"]
        return await execHerdr(["pane", "split", "--current", "--direction", args.direction, "--cwd", cwd, ...focusArgs])
      },
    }),

    herdr_pane_run: tool({
      description: "Run a shell command in a herdr pane like a real shell. Atomically sends command text + Enter. Use for cd, ls, tests, servers.",
      args: {
        paneId: tool.schema.string().describe("Target pane ID like w1G:p1"),
        command: tool.schema.string().describe("Shell command to run, e.g. 'cd /tmp && ls -la'"),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdr(["pane", "run", args.paneId, args.command])
      },
    }),

    herdr_pane_read: tool({
      description: "Read terminal output from a herdr pane. Use recent-unwrapped for logs/transcripts.",
      args: {
        paneId: tool.schema.string().describe("Target pane ID"),
        lines: tool.schema.number().optional().describe("Number of lines. Default 120."),
        source: tool.schema.enum(["visible", "recent", "recent-unwrapped", "detection"]).optional().describe("Read source. Default recent-unwrapped."),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdr([
          "pane",
          "read",
          args.paneId,
          "--source",
          args.source ?? "recent-unwrapped",
          "--lines",
          String(args.lines ?? 120),
        ])
      },
    }),

    herdr_pane_close: tool({
      description: "Close a herdr pane you created. Do not close panes you did not create unless user explicitly asked.",
      args: {
        paneId: tool.schema.string().describe("Pane ID to close"),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdr(["pane", "close", args.paneId])
      },
    }),

    herdr_tab_create: tool({
      description: "Create a new herdr tab (window) in current or specified workspace. Returns JSON with .result.tab.tab_id and .result.root_pane.",
      args: {
        cwd: tool.schema.string().optional().describe("Working directory. Defaults to session directory."),
        workspaceId: tool.schema.string().optional().describe("Workspace ID. Omit for current workspace."),
        label: tool.schema.string().optional().describe("Tab label"),
      },
      async execute(args, ctx) {
        ensureInHerdr()
        const extra: string[] = []
        if (args.workspaceId ?? process.env.HERDR_WORKSPACE_ID) extra.push("--workspace", (args.workspaceId ?? process.env.HERDR_WORKSPACE_ID)!)
        if (args.cwd ?? ctx.directory) extra.push("--cwd", (args.cwd ?? ctx.directory)!)
        if (args.label) extra.push("--label", args.label)
        extra.push("--no-focus")
        return await execHerdr(["tab", "create", ...extra])
      },
    }),

    herdr_workspace_create: tool({
      description: "Create a new herdr workspace (worksheet/project group). Returns JSON with .result.workspace, .result.tab, .result.root_pane.",
      args: {
        cwd: tool.schema.string().optional().describe("Working directory. Defaults to session directory."),
        label: tool.schema.string().optional().describe("Workspace label"),
      },
      async execute(args, ctx) {
        ensureInHerdr()
        const extra: string[] = []
        if (args.cwd ?? ctx.directory) extra.push("--cwd", (args.cwd ?? ctx.directory)!)
        if (args.label) extra.push("--label", args.label)
        extra.push("--no-focus")
        return await execHerdr(["workspace", "create", ...extra])
      },
    }),

    herdr_session_list: tool({
      description: "List named persistent herdr sessions (survive restarts). Different from panes/tabs.",
      args: {},
      async execute() {
        ensureInHerdr()
        return await execHerdr(["session", "list"])
      },
    }),

    herdr_agent_start: tool({
      description: "Launch an OpenCode (or other agent) shell in an existing herdr pane. Main use: after workspace_create, start opencode working in that workspace. Pane must be at interactive shell prompt. Use kind opencode.",
      args: {
        name: tool.schema.string().describe("Unique agent name, e.g. worker-1. Must match [a-z][a-z0-9_-]{0,31}"),
        paneId: tool.schema.string().describe("Existing pane ID from workspace_create .result.root_pane.pane_id or pane_split"),
        kind: tool.schema.string().optional().describe("Agent kind. Default opencode."),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdrLong(["agent", "start", args.name, "--kind", args.kind ?? "opencode", "--pane", args.paneId], 60000)
      },
    }),

    herdr_agent_prompt: tool({
      description: "Send work to a running herdr agent (e.g. opencode you started). Use --wait to wait for idle/done/blocked.",
      args: {
        target: tool.schema.string().describe("Agent name or pane ID hosting the agent"),
        prompt: tool.schema.string().describe("Work prompt to submit, e.g. 'Review diff and fix tests'"),
        wait: tool.schema.boolean().optional().describe("Wait for completion. Default true."),
        timeoutMs: tool.schema.number().optional().describe("Wait timeout ms. Default 120000."),
      },
      async execute(args) {
        ensureInHerdr()
        const extra: string[] = []
        if (args.wait ?? true) {
          extra.push("--wait", "--timeout", String(args.timeoutMs ?? 120000))
        }
        return await execHerdrLong(["agent", "prompt", args.target, args.prompt, ...extra], (args.timeoutMs ?? 120000) + 15000)
      },
    }),

    herdr_pane_send_text: tool({
      description: "Send literal shell text to a pane without Enter, or write shell script content. For interactive shells.",
      args: {
        paneId: tool.schema.string().describe("Target pane ID"),
        text: tool.schema.string().describe("Literal text to send, e.g. shell script snippet"),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdr(["pane", "send-text", args.paneId, args.text])
      },
    }),

    herdr_pane_wait_output: tool({
      description: "Wait for shell command output in a pane. Use after pane_run to wait for completion.",
      args: {
        paneId: tool.schema.string().describe("Target pane ID"),
        match: tool.schema.string().describe("Literal substring to wait for, e.g. 'test result'"),
        timeoutMs: tool.schema.number().optional().describe("Timeout ms. Default 60000."),
      },
      async execute(args) {
        ensureInHerdr()
        return await execHerdrLong(["pane", "wait-output", args.paneId, "--match", args.match, "--timeout", String(args.timeoutMs ?? 60000)], (args.timeoutMs ?? 60000) + 10000)
      },
    }),
  }
}
