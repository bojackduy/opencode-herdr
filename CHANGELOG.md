# Changelog

## 0.1.0 (2026-09-24) — Initial release

Forked from `gustavocaiano/opencode-herdr` (auto-split panes for subagent visibility) and renamed to `@bojackduy/opencode-herdr-control`.

- Explicit `herdr_*` tools for OpenCode agents: `herdr_status`, `herdr_pane_list` / `herdr_pane_split` / `herdr_pane_run` / `herdr_pane_read` / `herdr_pane_close` / `herdr_pane_send_text` / `herdr_pane_wait_output`, `herdr_tab_create`, `herdr_workspace_create`, `herdr_session_list`, `herdr_agent_start` / `herdr_agent_prompt`
- Full workflow: `workspace_create` → `pane_run` shell commands → `pane_read` → `agent_start opencode` → `agent_prompt`
- Config: `opencode-herdr-control.json` with legacy `opencode-herdr.json` fallback
