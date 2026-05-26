/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, onCleanup, onMount } from "solid-js"

const id = "alexandro.last-activity"
const DEFAULT_ACTIVE_WINDOW_MS = 5_000
const DEFAULT_STALLED_WINDOW_MS = 60_000
const MIN_STALLED_GAP_MS = 1_000
const EMPTY_LIST: readonly never[] = []

type Activity = {
  time: number
}

type Part = ReturnType<TuiPluginApi["state"]["part"]>[number]
type SessionStatus = ReturnType<TuiPluginApi["state"]["session"]["status"]>

type Tone = "muted" | "success" | "warning" | "error"

type LastActivityOptions = {
  compact: boolean
  activeWindowMs: number
  stalledWindowMs: number
}

function latestTime(...values: Array<number | undefined>) {
  let latest: number | undefined

  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue
    if (latest === undefined || value > latest) latest = value
  }

  return latest
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value === "true") return true
    if (value === "false") return false
  }
  return fallback
}

function readPositiveInt(value: unknown, fallback: number) {
  const candidate = typeof value === "string" && value.trim() ? Number(value) : value
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) return fallback
  const normalized = Math.floor(candidate)
  return normalized > 0 ? normalized : fallback
}

function normalizeOptions(options: Record<string, unknown> | undefined): LastActivityOptions {
  const activeWindowMs = readPositiveInt(options?.activeWindowMs, DEFAULT_ACTIVE_WINDOW_MS)
  const stalledWindowMs = Math.max(
    readPositiveInt(options?.stalledWindowMs, DEFAULT_STALLED_WINDOW_MS),
    activeWindowMs + MIN_STALLED_GAP_MS,
  )

  return {
    compact: readBoolean(options?.compact, false),
    activeWindowMs,
    stalledWindowMs,
  }
}

function readPartTimestamp(part: Part): number | undefined {
  switch (part.type) {
    case "reasoning":
      return latestTime(part.time.end, part.time.start)
    case "text":
      return latestTime(part.time?.end, part.time?.start)
    case "tool":
      if (part.state.status === "running") return latestTime(part.state.time.start)
      if (part.state.status === "completed") return latestTime(part.state.time.end, part.state.time.start)
      if (part.state.status === "error") return latestTime(part.state.time.end, part.state.time.start)
      return undefined
    case "retry":
      return latestTime(part.time.created)
    default:
      return undefined
  }
}

function latestActivity(api: TuiPluginApi, sessionID: string): Activity | undefined {
  const session = api.state.session.get(sessionID)
  const messages = api.state.session.messages(sessionID)
  let activity: Activity | undefined = latestTime(session?.time.updated)
    ? { time: latestTime(session?.time.updated)! }
    : undefined

  for (const message of messages) {
    const messageTime =
      message.role === "assistant"
        ? latestTime(message.time.completed, message.time.created)
        : latestTime(message.time.created)
    if (messageTime !== undefined && (!activity || messageTime > activity.time)) {
      activity = { time: messageTime }
    }

    for (const part of api.state.part(message.id)) {
      const partTime = readPartTimestamp(part)
      if (partTime !== undefined && (!activity || partTime > activity.time)) {
        activity = { time: partTime }
      }
    }
  }

  return activity
}

function formatAgo(ms: number, compact: boolean) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 5) return compact ? "now" : "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function buildLabel(
  settings: LastActivityOptions,
  status: SessionStatus | undefined,
  activity: Activity | undefined,
  now: number,
  waitingOnPermission: boolean,
  waitingOnQuestion: boolean,
) {
  if (waitingOnPermission) {
    return { text: settings.compact ? "permission" : "waiting on permission", tone: "warning" as const }
  }

  if (waitingOnQuestion) {
    return { text: settings.compact ? "question" : "waiting on question", tone: "warning" as const }
  }

  if (!activity) {
    return status?.type === "busy"
      ? { text: settings.compact ? "active" : "active now", tone: "success" as const }
      : { text: "idle", tone: "muted" as const }
  }

  const age = Math.max(0, now - activity.time)
  if (status?.type === "retry") {
    return {
      text: settings.compact ? `retry ${formatAgo(age, true)}` : `retrying ${formatAgo(age, false)}`,
      tone: "warning" as const,
    }
  }

  if (status?.type === "idle") {
    return {
      text: settings.compact ? formatAgo(age, true) : `last activity ${formatAgo(age, false)}`,
      tone: "muted" as const,
    }
  }

  if (age <= settings.activeWindowMs) {
    return { text: settings.compact ? "active" : "active now", tone: "success" as const }
  }

  if (age >= settings.stalledWindowMs) {
    return {
      text: settings.compact ? `stalled ${formatAgo(age, true)}` : `possibly stalled ${formatAgo(age, false)}`,
      tone: "error" as const,
    }
  }

  return {
    text: settings.compact ? formatAgo(age, true) : `last activity ${formatAgo(age, false)}`,
    tone: "muted" as const,
  }
}

function View(props: { api: TuiPluginApi; sessionID: string; settings: LastActivityOptions }) {
  const [tick, setTick] = createSignal(Date.now())

  onMount(() => {
    const timer = setInterval(() => setTick(Date.now()), 1_000)
    onCleanup(() => clearInterval(timer))
  })

  const status = createMemo<SessionStatus | undefined>(() => props.api.state.session.status(props.sessionID))
  const permissions = createMemo(() => props.api.state.session.permission(props.sessionID) ?? EMPTY_LIST)
  const questions = createMemo(() => props.api.state.session.question(props.sessionID) ?? EMPTY_LIST)

  // Re-scan message state only when the underlying session data changes.
  const last = createMemo(() => latestActivity(props.api, props.sessionID))

  const view = createMemo<{ text: string; tone: Tone }>(() => {
    return buildLabel(props.settings, status(), last(), tick(), permissions().length > 0, questions().length > 0)
  })

  const color = createMemo(() => {
    const theme = props.api.theme.current
    switch (view().tone) {
      case "warning":
        return theme.warning
      case "error":
        return theme.error
      case "success":
        return theme.success
      default:
        return theme.textMuted
    }
  })

  return <text fg={color()}>{view().text}</text>
}

const tui: TuiPlugin = async (api, options) => {
  const settings = normalizeOptions(options)

  api.slots.register({
    order: 100,
    slots: {
      session_prompt_right(_ctx, props) {
        return <View api={api} sessionID={props.session_id} settings={settings} />
      },
    },
  })
}

export default {
  id,
  tui,
}
