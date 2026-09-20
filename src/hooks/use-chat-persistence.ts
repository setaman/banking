/**
 * use-chat-persistence — client-side hook for persisting the AI Assistant's
 * single conversation to localStorage.
 *
 * Hydration-safe: this page is server-rendered (Next.js App Router still
 * SSRs "use client" pages for the initial HTML), where `window` doesn't
 * exist, so any state whose *first* value depends on `localStorage` would
 * differ between the server-rendered markup and the client's initial
 * hydration pass — React would (correctly) warn about a hydration mismatch,
 * and any UI derived from that state (e.g. the Clear-conversation button's
 * `disabled` prop) would flip its rendered attribute between server and
 * client.
 *
 * To avoid this, `initialMessages` is always `[]` (matching what the server
 * rendered), and the real localStorage read is exposed via
 * `useSyncExternalStore` (`restoredMessages` / `hasHydrated`) rather than a
 * `useEffect` + `setState` pair — `useSyncExternalStore` is the React-native
 * way to read a browser-only data source: it returns the given
 * *server* snapshot during SSR and the initial client hydration pass (so
 * hydration always matches), then automatically schedules a client-only
 * re-render with the *real* snapshot immediately after. The caller applies
 * the restored conversation to `useChat` via `setMessages` once it appears
 * — itself a normal post-hydration client update, not part of the initial
 * render, so it can never cause a hydration mismatch either.
 *
 * Persists each message's full `parts` array (not just joined text) so the
 * PR #36 tool-evidence panel survives a reload — but only a strict allowlist
 * of part shapes, matched exactly to what `POST /api/chat` (see
 * `src/app/api/chat/route.ts`) will accept when a restored message is sent
 * back as part of a follow-up question: the approval-state guard, the
 * part-type allowlist, and `convertToModelMessages(...,
 * { ignoreIncompleteToolCalls: true })`. Concretely:
 *  - `text` parts: kept, `state` stripped (normalized away
 *    "streaming"/"done", which never make sense for an already-finished,
 *    persisted message).
 *  - `reasoning` parts: kept (text + `providerMetadata`, plain JSON), same
 *    `state` stripping.
 *  - `step-start` parts: kept as-is.
 *  - Tool parts (`isToolUIPart`, static `tool-<name>` or `dynamic-tool`):
 *    kept ONLY in a terminal state (`output-available`, `output-error`,
 *    `output-denied`). `input-streaming`/`input-available` are incomplete
 *    (an orphaned tool call with no result yet — meaningless once the page
 *    reloads and the stream is long gone), and `approval-requested`/
 *    `approval-responded` are rejected outright by the route with a 400.
 *  - Everything else (`file`, `reasoning-file`, `source-url`,
 *    `source-document`, `custom`, `data-*`) is dropped — this app's client
 *    never legitimately produces them (see the route's part-allowlist
 *    comment), and the route rejects them as malformed.
 *
 * Tool outputs can carry real transaction data (dozens of rows per
 * `search_transactions`/`get_largest_expenses` call) and are large, so the
 * write path enforces a byte budget and degrades gracefully under
 * localStorage's ~5MB quota — see `fitToByteBudget` and `writeToStorage`.
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { isToolUIPart } from "ai";
import type {
  DynamicToolUIPart,
  ProviderMetadata,
  ToolUIPart,
  UIMessage,
  UITools,
} from "ai";

// Bumped from v1: the previous flat `{id, role, content, timestamp}` shape
// cannot represent tool parts at all. Existing v1 conversations are
// intentionally NOT migrated (product decision — see PR description) and the
// v1 key is never read.
const STORAGE_KEY = "banking:assistant:conversation:v2";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PersistedChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly timestamp: string;
  readonly parts: readonly PersistedMessagePart[];
}

export interface UseChatPersistenceReturn {
  /** Always `[]` — a hydration-safe seed for `useChat`, matching SSR output. */
  readonly initialMessages: UIMessage[];
  /**
   * The conversation restored from localStorage, if one exists — `null`
   * until hydration has finished (see `hasHydrated`), or if there was
   * nothing to restore. The caller applies this to `useChat` via
   * `setMessages` in an effect once it appears.
   */
  readonly restoredMessages: UIMessage[] | null;
  /** True once the post-hydration localStorage read is available (client-only). */
  readonly hasHydrated: boolean;
  /** Persists the given UI messages (skips the very first call). */
  persist: (messages: UIMessage[]) => void;
  /** Returns the stable first-seen timestamp for a message id, creating one on first lookup. */
  getTimestamp: (id: string) => string;
  /** Wipes the persisted conversation and resets internal timestamp cache. */
  clear: () => void;
}

interface PersistedConversation {
  readonly messages: PersistedChatMessage[];
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// Persisted part shapes — the allowlist. Kept structurally close to the AI
// SDK's own `UIMessagePart` shapes (see `node_modules/ai/dist/index.d.ts`)
// rather than reusing them directly, since we deliberately persist only a
// subset of their optional fields (no `title`/`toolMetadata`/`preliminary`).
// ---------------------------------------------------------------------------

export interface PersistedTextPart {
  readonly type: "text";
  readonly text: string;
}

export interface PersistedReasoningPart {
  readonly type: "reasoning";
  readonly text: string;
  readonly providerMetadata?: ProviderMetadata;
}

export interface PersistedStepStartPart {
  readonly type: "step-start";
}

interface PersistedToolApproval {
  readonly id: string;
  readonly approved: false;
  readonly reason?: string;
  readonly isAutomatic?: boolean;
  readonly signature?: string;
}

interface PersistedToolPartBase {
  readonly type: `tool-${string}` | "dynamic-tool";
  readonly toolCallId: string;
  /** Only meaningful (and only ever set) when `type === "dynamic-tool"`. */
  readonly toolName?: string;
  readonly providerExecuted?: boolean;
}

/**
 * Tool parts are only ever persisted in a terminal state — see the module
 * doc comment. `approval` is intentionally omitted from the
 * `output-available`/`output-error` branches (this app defines no
 * approval-gated tools, see `route.ts`, so it's never populated there in
 * practice) but is kept, required, on `output-denied` — the AI SDK's own
 * `ToolUIPart`/`DynamicToolUIPart` types require it for that state, so
 * dropping it would make a restored `output-denied` part fail to satisfy
 * the SDK's own type.
 */
export type PersistedToolPart = PersistedToolPartBase &
  (
    | {
        readonly state: "output-available";
        readonly input: unknown;
        readonly output: unknown;
        readonly callProviderMetadata?: ProviderMetadata;
        readonly resultProviderMetadata?: ProviderMetadata;
      }
    | {
        readonly state: "output-error";
        readonly input: unknown;
        readonly errorText: string;
        readonly callProviderMetadata?: ProviderMetadata;
        readonly resultProviderMetadata?: ProviderMetadata;
      }
    | {
        readonly state: "output-denied";
        readonly input: unknown;
        readonly approval: PersistedToolApproval;
        readonly callProviderMetadata?: ProviderMetadata;
      }
  );

export type PersistedMessagePart =
  | PersistedTextPart
  | PersistedReasoningPart
  | PersistedStepStartPart
  | PersistedToolPart;

const TERMINAL_TOOL_STATES = new Set<string>([
  "output-available",
  "output-error",
  "output-denied",
]);

function isTerminalToolState(
  state: string
): state is "output-available" | "output-error" | "output-denied" {
  return TERMINAL_TOOL_STATES.has(state);
}

function isPersistedToolPart(
  part: PersistedMessagePart
): part is PersistedToolPart {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function isPersistedTextPart(
  part: PersistedMessagePart
): part is PersistedTextPart {
  return part.type === "text";
}

// ---------------------------------------------------------------------------
// UIMessage -> PersistedMessagePart (write path)
// ---------------------------------------------------------------------------

/**
 * Extracts the allowlisted fields from a terminal-state tool part. The
 * caller (`toPersistedParts`) already guarantees `part.state` is terminal.
 */
function toPersistedToolPart(
  part: ToolUIPart<UITools> | DynamicToolUIPart
): PersistedToolPart | null {
  const base: PersistedToolPartBase = {
    type: part.type,
    toolCallId: part.toolCallId,
    ...(part.type === "dynamic-tool" ? { toolName: part.toolName } : {}),
    ...(part.providerExecuted !== undefined
      ? { providerExecuted: part.providerExecuted }
      : {}),
  };

  switch (part.state) {
    case "output-available":
      return {
        ...base,
        state: "output-available",
        input: part.input,
        output: part.output,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
        ...(part.resultProviderMetadata !== undefined
          ? { resultProviderMetadata: part.resultProviderMetadata }
          : {}),
      };
    case "output-error":
      return {
        ...base,
        state: "output-error",
        input: part.input,
        errorText: part.errorText,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
        ...(part.resultProviderMetadata !== undefined
          ? { resultProviderMetadata: part.resultProviderMetadata }
          : {}),
      };
    case "output-denied":
      return {
        ...base,
        state: "output-denied",
        input: part.input,
        approval: part.approval,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
      };
    default:
      // Non-terminal state (input-streaming, input-available,
      // approval-requested, approval-responded) — caller filters these out
      // before calling this function; reachable only if that guard changes.
      return null;
  }
}

/** Filters a UI message's parts down to the persisted allowlist. */
function toPersistedParts(message: UIMessage): PersistedMessagePart[] {
  const result: PersistedMessagePart[] = [];
  for (const part of message.parts) {
    if (part.type === "text") {
      result.push({ type: "text", text: part.text });
      continue;
    }
    if (part.type === "reasoning") {
      result.push(
        part.providerMetadata !== undefined
          ? {
              type: "reasoning",
              text: part.text,
              providerMetadata: part.providerMetadata,
            }
          : { type: "reasoning", text: part.text }
      );
      continue;
    }
    if (part.type === "step-start") {
      result.push({ type: "step-start" });
      continue;
    }
    if (isToolUIPart(part) && isTerminalToolState(part.state)) {
      const persisted = toPersistedToolPart(part);
      if (persisted) result.push(persisted);
      continue;
    }
    // Dropped: non-terminal tool states, and any part type this app's
    // client never legitimately produces (file, source-*, data-*, custom).
  }
  return result;
}

/**
 * Builds the persistable message list from `useChat`'s current messages. A
 * message left with zero parts after filtering (e.g. only a non-terminal
 * tool call, nothing else) is skipped entirely rather than persisted as an
 * empty shell.
 */
function buildPersistedMessages(
  messages: readonly UIMessage[],
  getTimestamp: (id: string) => string
): PersistedChatMessage[] {
  const result: PersistedChatMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const parts = toPersistedParts(m);
    if (parts.length === 0) continue;
    result.push({
      id: m.id,
      role: m.role,
      timestamp: getTimestamp(m.id),
      parts,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// PersistedMessagePart -> UIMessage (read path)
// ---------------------------------------------------------------------------

function buildToolStateFields(part: PersistedToolPart) {
  switch (part.state) {
    case "output-available":
      return {
        state: "output-available" as const,
        input: part.input,
        output: part.output,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
        ...(part.resultProviderMetadata !== undefined
          ? { resultProviderMetadata: part.resultProviderMetadata }
          : {}),
      };
    case "output-error":
      return {
        state: "output-error" as const,
        input: part.input,
        errorText: part.errorText,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
        ...(part.resultProviderMetadata !== undefined
          ? { resultProviderMetadata: part.resultProviderMetadata }
          : {}),
      };
    case "output-denied":
      return {
        state: "output-denied" as const,
        input: part.input,
        approval: part.approval,
        ...(part.callProviderMetadata !== undefined
          ? { callProviderMetadata: part.callProviderMetadata }
          : {}),
      };
  }
}

function toRuntimeToolPart(
  part: PersistedToolPart
): ToolUIPart<UITools> | DynamicToolUIPart {
  const stateFields = buildToolStateFields(part);
  if (part.type === "dynamic-tool") {
    return {
      type: "dynamic-tool",
      toolCallId: part.toolCallId,
      toolName: part.toolName ?? "unknown_tool",
      ...(part.providerExecuted !== undefined
        ? { providerExecuted: part.providerExecuted }
        : {}),
      ...stateFields,
    };
  }
  return {
    type: part.type,
    toolCallId: part.toolCallId,
    ...(part.providerExecuted !== undefined
      ? { providerExecuted: part.providerExecuted }
      : {}),
    ...stateFields,
  };
}

function toRuntimePart(part: PersistedMessagePart): UIMessage["parts"][number] {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "reasoning":
      return part.providerMetadata !== undefined
        ? {
            type: "reasoning",
            text: part.text,
            providerMetadata: part.providerMetadata,
          }
        : { type: "reasoning", text: part.text };
    case "step-start":
      return { type: "step-start" };
    default:
      return toRuntimeToolPart(part);
  }
}

/**
 * Restores a persisted message back into a real `UIMessage`, passing `parts`
 * through directly (rather than rebuilding a single text part) so tool
 * evidence renders again after a reload.
 */
function toUIMessage(message: PersistedChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.map(toRuntimePart),
  };
}

// ---------------------------------------------------------------------------
// Load-time validation
//
// All-or-nothing validation would silently discard an entire conversation
// over one corrupted message. Instead: validate messages in order and keep
// the valid PREFIX up to (but not including) the first invalid one — dropping
// from the middle would orphan a question from its answer. `console.warn`
// whenever anything is actually pruned, so a corrupted/rejected conversation
// is diagnosable instead of silently vanishing.
//
// Tool `input`/`output` are deliberately NOT deep-validated here — that's
// `safeValidateUIMessages`'s job on the server (see `route.ts`), and
// re-deriving the finance tools' zod schemas here would just be a second,
// divergence-prone copy of validation this hook has no business owning.
// ---------------------------------------------------------------------------

function isPersistedTextPartShape(value: unknown): value is PersistedTextPart {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return c.type === "text" && typeof c.text === "string";
}

function isPersistedReasoningPartShape(
  value: unknown
): value is PersistedReasoningPart {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return c.type === "reasoning" && typeof c.text === "string";
}

function isPersistedStepStartPartShape(
  value: unknown
): value is PersistedStepStartPart {
  if (typeof value !== "object" || value === null) return false;
  return (value as Record<string, unknown>).type === "step-start";
}

function isPersistedToolPartShape(value: unknown): value is PersistedToolPart {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (
    typeof c.type !== "string" ||
    !(c.type.startsWith("tool-") || c.type === "dynamic-tool")
  ) {
    return false;
  }
  if (typeof c.toolCallId !== "string") return false;
  if (c.type === "dynamic-tool" && typeof c.toolName !== "string") {
    return false;
  }
  if (typeof c.state !== "string" || !isTerminalToolState(c.state))
    return false;
  if (c.state === "output-error" && typeof c.errorText !== "string")
    return false;
  if (
    c.state === "output-denied" &&
    (typeof c.approval !== "object" || c.approval === null)
  ) {
    return false;
  }
  return true;
}

function isPersistedMessagePartShape(
  value: unknown
): value is PersistedMessagePart {
  return (
    isPersistedTextPartShape(value) ||
    isPersistedReasoningPartShape(value) ||
    isPersistedStepStartPartShape(value) ||
    isPersistedToolPartShape(value)
  );
}

function isPersistedChatMessageShape(
  value: unknown
): value is PersistedChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    (c.role === "user" || c.role === "assistant") &&
    typeof c.timestamp === "string" &&
    Array.isArray(c.parts) &&
    c.parts.every(isPersistedMessagePartShape)
  );
}

/**
 * Validates `candidate` (the raw, parsed `messages` array from storage) and
 * returns the valid leading prefix, or `null` if nothing (including the
 * first message) is valid.
 */
function pruneToValidPrefix(
  candidate: unknown[]
): PersistedChatMessage[] | null {
  const valid: PersistedChatMessage[] = [];
  for (const item of candidate) {
    if (!isPersistedChatMessageShape(item)) break;
    valid.push(item);
  }
  if (valid.length < candidate.length) {
    console.warn(
      `chat-persistence: dropped ${candidate.length - valid.length} message(s) from a corrupted/incompatible persisted conversation (kept the first ${valid.length}).`
    );
  }
  return valid.length > 0 ? valid : null;
}

/**
 * Attempts to read and validate the persisted conversation from
 * localStorage. Returns `null` on the server, when the key is absent, or
 * when the stored value's outer shape isn't even a messages array.
 */
function loadFromStorage(): PersistedChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { messages } = parsed as { messages?: unknown };
    if (!Array.isArray(messages)) return null;
    return pruneToValidPrefix(messages);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write path: byte budget + quota handling
//
// Tool outputs carry transaction rows and can be large, and localStorage is
// a shared, ~5MB-total resource. Before ever attempting a write:
//  1. Serialize the full payload; if it exceeds `BYTE_BUDGET`, strip tool
//     parts from the OLDEST assistant messages first, one message at a
//     time, re-measuring after each, until it fits or no tool parts remain.
//  2. The actual `localStorage.setItem` call is still wrapped in try/catch —
//     step 1 bounds the common case, but quota can already be consumed by
//     other keys. On failure, retry once with a text-only payload (all
//     tool/reasoning parts stripped). Text content must never be lost to a
//     quota failure.
// ---------------------------------------------------------------------------

const BYTE_BUDGET = 256 * 1024; // 256KB

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function serialize(messages: readonly PersistedChatMessage[]): string {
  const payload: PersistedConversation = {
    messages: [...messages],
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

/**
 * Strips tool parts from the oldest assistant messages first (one at a
 * time, re-measuring) until the serialized payload fits `BYTE_BUDGET` or no
 * tool parts remain anywhere. A message that ends up with zero parts once
 * its tool parts are removed is dropped outright, consistent with
 * `buildPersistedMessages` never persisting an empty-parts message.
 */
function fitToByteBudget(
  messages: readonly PersistedChatMessage[]
): PersistedChatMessage[] {
  let working = [...messages];
  while (byteLength(serialize(working)) > BYTE_BUDGET) {
    const index = working.findIndex((m) => m.parts.some(isPersistedToolPart));
    if (index === -1) break;
    const strippedParts = working[index].parts.filter(
      (p) => !isPersistedToolPart(p)
    );
    working =
      strippedParts.length > 0
        ? working.map((m, i) =>
            i === index ? { ...m, parts: strippedParts } : m
          )
        : [...working.slice(0, index), ...working.slice(index + 1)];
  }
  return working;
}

/** Strips a message down to just its text parts. */
function toTextOnlyMessage(
  message: PersistedChatMessage
): PersistedChatMessage {
  return { ...message, parts: message.parts.filter(isPersistedTextPart) };
}

/**
 * Writes the (already byte-budgeted) message list to localStorage. On a
 * quota/write failure, retries once with a text-only payload so plain
 * conversation text is never lost even when tool evidence can't fit.
 */
function writeToStorage(messages: readonly PersistedChatMessage[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serialize(messages));
    return;
  } catch {
    console.warn(
      "chat-persistence: localStorage write failed (likely quota exceeded); retrying with a text-only conversation. Tool evidence for this session may not survive a reload."
    );
  }
  try {
    const textOnly = messages
      .map(toTextOnlyMessage)
      .filter((m) => m.parts.length > 0);
    window.localStorage.setItem(STORAGE_KEY, serialize(textOnly));
  } catch {
    // The text-only retry also failed (storage disabled entirely, e.g.
    // private browsing) — nothing more can be done without losing text, so
    // give up silently rather than throwing out of a persistence side-effect.
  }
}

/** Persists the conversation. Fails silently beyond the retry above. */
function saveToStorage(messages: readonly PersistedChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    writeToStorage(fitToByteBudget(messages));
  } catch {
    // Intentionally silent — matches the previous behavior for anything
    // unexpected outside the quota-handling path above (e.g. `JSON.stringify`
    // throwing on a circular structure, which shouldn't occur for this data).
  }
}

function clearStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Intentionally silent.
  }
}

// ---------------------------------------------------------------------------
// `useSyncExternalStore` plumbing — a distinct sentinel (rather than `null`)
// marks "haven't produced a client snapshot yet" so it's distinguishable
// from "checked localStorage, found nothing" (a legitimate `null`). The
// client snapshot itself is cached at module scope: `useSyncExternalStore`
// requires `getSnapshot` to return a referentially-stable value when
// nothing has changed (React re-invokes it on every render to detect
// updates), and re-parsing localStorage on every render would both violate
// that contract and be wasteful. `clear()` resets the cache so a
// subsequently-restored hook consumer doesn't see stale data.
// ---------------------------------------------------------------------------

const NOT_YET_HYDRATED = Symbol("chat-persistence-not-yet-hydrated");

type Snapshot = PersistedChatMessage[] | null | typeof NOT_YET_HYDRATED;

let cachedSnapshot: PersistedChatMessage[] | null | undefined;

function subscribe(): () => void {
  // Nothing external notifies us of localStorage changes made outside this
  // hook (and this hook is the sole writer) — a one-time post-hydration
  // client snapshot is all `restoredMessages` needs, so no-op.
  return () => {};
}

function getClientSnapshot(): Snapshot {
  if (cachedSnapshot === undefined) {
    cachedSnapshot = loadFromStorage();
  }
  return cachedSnapshot;
}

function getServerSnapshot(): Snapshot {
  return NOT_YET_HYDRATED;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatPersistence(): UseChatPersistenceReturn {
  const timestampsRef = useRef<Map<string, string>>(new Map());
  const isFirstPersist = useRef(true);

  const snapshot = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );
  const hasHydrated = snapshot !== NOT_YET_HYDRATED;
  const storedMessages = hasHydrated
    ? (snapshot as PersistedChatMessage[] | null)
    : null;

  const restoredMessages = useMemo<UIMessage[] | null>(() => {
    if (!storedMessages || storedMessages.length === 0) return null;
    return storedMessages.map(toUIMessage);
  }, [storedMessages]);

  // Seed the timestamp cache for restored messages (a ref mutation, not
  // state — doesn't trigger a render) so `getTimestamp` returns each
  // message's real persisted timestamp the first time it's rendered.
  useEffect(() => {
    if (!storedMessages) return;
    for (const m of storedMessages) {
      timestampsRef.current.set(m.id, m.timestamp);
    }
  }, [storedMessages]);

  const getTimestamp = useCallback((id: string): string => {
    const existing = timestampsRef.current.get(id);
    if (existing) return existing;
    const now = new Date().toISOString();
    timestampsRef.current.set(id, now);
    return now;
  }, []);

  const persist = useCallback(
    (messages: UIMessage[]): void => {
      if (isFirstPersist.current) {
        // Skip the initial mount — this would just write back what was
        // just read (or an empty conversation).
        isFirstPersist.current = false;
        return;
      }
      saveToStorage(buildPersistedMessages(messages, getTimestamp));
    },
    [getTimestamp]
  );

  const clear = useCallback((): void => {
    clearStorage();
    timestampsRef.current.clear();
    isFirstPersist.current = true;
    cachedSnapshot = null;
  }, []);

  return {
    initialMessages: [],
    restoredMessages,
    hasHydrated,
    persist,
    getTimestamp,
    clear,
  };
}
