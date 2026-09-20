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
 * of part shapes, structurally aligned with what `POST /api/chat` (see
 * `src/app/api/chat/route.ts`) will accept when a restored message is sent
 * back as part of a follow-up question: the approval-state guard, the
 * part-type allowlist, and `convertToModelMessages(...,
 * { ignoreIncompleteToolCalls: true })`. "Aligned" is deliberately narrower
 * than "matched exactly": this module checks part *shape* (type, state,
 * required fields present) only. It does NOT validate a tool part's `input`
 * against that tool's zod schema — that stays `safeValidateUIMessages`'s job
 * server-side (duplicating the finance tools' zod schemas here would be a
 * second, divergence-prone copy of validation the server already owns). So a
 * structurally-valid persisted part with a semantically-wrong `input` (e.g.
 * `{ limit: "not-a-number" }`) still loads cleanly here and still gets
 * rejected with a 400 on the next request — this module cannot and does not
 * prevent that. Concretely, the structural allowlist is:
 *  - `text` parts: kept (text + `providerMetadata`, plain JSON), `state`
 *    stripped (normalized away "streaming"/"done", which never make sense
 *    for an already-finished, persisted message). `providerMetadata` matters
 *    here exactly as it does for tool/reasoning parts below: `@ai-sdk/google`
 *    attaches a `thoughtSignature` to TEXT parts too (not just tool calls),
 *    and Gemini 3's `skip_thought_signature_validator` fallback only covers
 *    `functionCall` parts — a text part replayed without its signature has
 *    no such safety net. Dropping it here would silently discard that.
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

// The v1 key is never read (see the comment above) but was also never
// cleaned up, so every browser that ever used the old shape carries a dead
// blob for the life of the origin. No migration (product decision), but we
// reclaim the space once per load — see `pruneLegacyV1Key`.
const LEGACY_STORAGE_KEY_V1 = "banking:assistant:conversation:v1";

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
  /**
   * Preserved verbatim, same as `PersistedReasoningPart.providerMetadata` —
   * see the module doc comment's `text` bullet for why this can't be
   * dropped for a Gemini 3 client (thought-signature continuity).
   */
  readonly providerMetadata?: ProviderMetadata;
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

/**
 * A part counts as "content" for the purposes of deciding whether a message
 * is an empty shell — `text`, `reasoning`, and tool parts all carry
 * something a user or the model could see again after a reload.
 * `step-start` deliberately does NOT count: it's a bookkeeping marker the
 * SDK emits at the start of every agent step, not content, and a message
 * that (after filtering) contains only `step-start` parts (e.g. `[step-
 * start, tool-x(input-available)]` with the tool call stripped because it
 * never reached a terminal state — see the module doc comment) renders as an
 * empty avatar-only "ghost bubble" with no way to remove it short of
 * clearing the whole conversation.
 */
function isMeaningfulPart(part: PersistedMessagePart): boolean {
  return (
    part.type === "text" ||
    part.type === "reasoning" ||
    isPersistedToolPart(part)
  );
}

/** True when `parts` contains no text, reasoning, or tool part — see `isMeaningfulPart`. */
function hasNoMeaningfulContent(
  parts: readonly PersistedMessagePart[]
): boolean {
  return !parts.some(isMeaningfulPart);
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
      // A static tool part (`tool-<name>`, not `dynamic-tool`) whose input
      // failed the SDK's own validation is emitted with `input: undefined`
      // and the rejected payload kept separately in `rawInput` (see
      // `updateToolPart`'s "tool-input-error" case in
      // `node_modules/ai/dist/index.js`, and the `ToolUIPart` "output-error"
      // branch in `node_modules/ai/dist/index.d.ts`, which types `input` as
      // `... | undefined` specifically for this state). We don't persist
      // `rawInput`, so if we persisted `input: undefined` here,
      // `JSON.stringify` would drop the key entirely (it never round-trips
      // through `JSON.parse` as `undefined`), and our own
      // `isPersistedToolPartShape` — which requires `"input" in c` — would
      // then reject the reloaded part, which `pruneToValidPrefix` treats as
      // corruption and truncates from there on, silently amputating every
      // later message. Returning `null` drops just this tool part instead
      // (the caller falls back to `hasNoMeaningfulContent`, so a message
      // left with only a `step-start` after this is skipped entirely, and a
      // message that also has real text still persists that text). This
      // also matches the installed `ai@7.0.22`'s own `safeValidateUIMessages`
      // (`uiMessagesSchema`), which never validates `input` against the
      // tool's zod schema for `output-error` — only for
      // `input-available`/`output-available` — so there is no fixed-up
      // upstream schema that would accept this shape more usefully anyway;
      // the failed call simply isn't worth persisting.
      if (part.input === undefined) return null;
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
      result.push(
        part.providerMetadata !== undefined
          ? {
              type: "text",
              text: part.text,
              providerMetadata: part.providerMetadata,
            }
          : { type: "text", text: part.text }
      );
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

// ---------------------------------------------------------------------------
// Message-count cap
//
// `route.ts`'s `MAX_MESSAGES` (50) is checked BEFORE that route's own
// `trimToRecentPairs` trims history — so a conversation that grows past 50
// UIMessages gets a flat `400 invalid_request` on every request, and since
// this hook restores from localStorage on every load, a reload does NOT
// recover it: the assistant stays bricked until the user clicks Clear. The
// byte budget below (`BYTE_BUDGET`/`fitToByteBudget`) bounds payload SIZE,
// not message COUNT — a long run of short text-only exchanges can blow past
// 50 messages while staying tiny in bytes. `MAX_PERSISTED_MESSAGES` is that
// missing count cap, kept comfortably under 50 so it — plus whatever
// `assistant/page.tsx`'s `buildOutgoingMessages` does with the persisted
// history on top of it — never approaches the server's ceiling. See
// `buildOutgoingMessages`'s doc comment in `page.tsx`, which reuses this same
// constant, for the other half of the fix.
// ---------------------------------------------------------------------------

export const MAX_PERSISTED_MESSAGES = 40;

/**
 * Slices `messages` down to at most `limit` most recent entries, then drops
 * any leading assistant messages so the result starts on a `user` message
 * (or is empty). Mirrors `trimToRecentPairs`'s leading-`user` guard in
 * `route.ts`: a plain `slice(-limit)` can land the cut point on an assistant
 * message just as easily as a user one, and a history that starts with
 * `role: "assistant"` converts into a `ModelMessage[]` whose first entry has
 * `role: "assistant"` — which the provider rejects outright. Exported so
 * `page.tsx`'s `buildOutgoingMessages` can apply the identical cap to the
 * OUTGOING request, not just what's persisted.
 */
export function capMessageCount<T extends { readonly role: string }>(
  messages: readonly T[],
  limit: number
): T[] {
  const capped = messages.slice(-limit);
  let firstUserIndex = 0;
  while (
    firstUserIndex < capped.length &&
    capped[firstUserIndex].role !== "user"
  ) {
    firstUserIndex++;
  }
  return capped.slice(firstUserIndex);
}

/**
 * Builds the persistable message list from `useChat`'s current messages. A
 * message left with no meaningful content after filtering (e.g. only a
 * non-terminal tool call and/or a bare `step-start`, nothing else — see
 * `hasNoMeaningfulContent`) is skipped entirely rather than persisted as an
 * empty "ghost bubble" shell. The result is then capped to the most recent
 * `MAX_PERSISTED_MESSAGES` messages (see that constant's doc comment).
 */
function buildPersistedMessages(
  messages: readonly UIMessage[],
  getTimestamp: (id: string) => string
): PersistedChatMessage[] {
  const result: PersistedChatMessage[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const parts = toPersistedParts(m);
    if (hasNoMeaningfulContent(parts)) continue;
    result.push({
      id: m.id,
      role: m.role,
      timestamp: getTimestamp(m.id),
      parts,
    });
  }
  return capMessageCount(result, MAX_PERSISTED_MESSAGES);
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
      return part.providerMetadata !== undefined
        ? {
            type: "text",
            text: part.text,
            providerMetadata: part.providerMetadata,
          }
        : { type: "text", text: part.text };
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

  // Every terminal state's persisted shape (see `PersistedToolPart`)
  // requires `input`. Use `in` (does the key exist at all) AND an explicit
  // `!== undefined` check (a key present but holding `undefined` — possible
  // from a hand-edited/legacy storage value, since `JSON.parse` can never
  // itself produce `undefined` but this validator must not assume its input
  // came only from `JSON.parse`) rather than deep-validating against the
  // tools' zod schemas, which stays the server's job (see the block comment
  // above). Without this, a part like `{state: "output-available"}` with no
  // `input`/`output` loads cleanly here, then fails the server's
  // `safeValidateUIMessages` with a 400 on every subsequent request — and
  // since it's already in localStorage, that 400 repeats forever until the
  // user clears the conversation.
  if (!("input" in c) || c.input === undefined) return false;

  if (
    c.state === "output-available" &&
    (!("output" in c) || c.output === undefined)
  ) {
    return false;
  }
  if (c.state === "output-error" && typeof c.errorText !== "string")
    return false;
  if (c.state === "output-denied") {
    if (typeof c.approval !== "object" || c.approval === null) return false;
    const approval = c.approval as Record<string, unknown>;
    if (typeof approval.id !== "string") return false;
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

// Guards `pruneLegacyV1Key` to run at most once per module lifetime (a fresh
// value on every full page load, which is the granularity that matters —
// there's no benefit to re-attempting `removeItem` on every soft-nav
// remount of a component that shares this module).
let hasPrunedLegacyV1Key = false;

/**
 * Removes the orphaned v1 storage key once, defensively. No migration is
 * performed (product decision — see the module doc comment): this exists
 * purely to stop a dead blob from occupying localStorage for the life of
 * the origin. Must never throw out of a read path, so a disabled/unavailable
 * `localStorage` (e.g. some private-browsing modes) is silently ignored.
 */
function pruneLegacyV1Key(): void {
  if (hasPrunedLegacyV1Key) return;
  hasPrunedLegacyV1Key = true;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
  } catch {
    // Intentionally silent — see doc comment above.
  }
}

/**
 * Attempts to read and validate the persisted conversation from
 * localStorage. Returns `null` on the server, when the key is absent, or
 * when the stored value's outer shape isn't even a messages array.
 */
function loadFromStorage(): PersistedChatMessage[] | null {
  if (typeof window === "undefined") return null;
  pruneLegacyV1Key();
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
 * tool parts remain anywhere. A message left with no meaningful content
 * once its tool parts are removed (e.g. it was just `[step-start, tool-x]`)
 * is dropped outright — checked via `hasNoMeaningfulContent`, not a bare
 * `length > 0`, since a stripped `[step-start]` remainder has length 1 but
 * is still an empty "ghost bubble" shell (see that helper's doc comment and
 * `buildPersistedMessages`, which applies the identical rule before this
 * function ever runs).
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
    working = !hasNoMeaningfulContent(strippedParts)
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
 *
 * Returns exactly what ended up in storage (`messages` verbatim, the
 * text-only fallback, or `null` if both writes failed) so the caller
 * (`saveToStorage`) can keep `cachedSnapshot` in sync with reality rather
 * than with what was merely requested — see that module-scope cache's doc
 * comment.
 */
function writeToStorage(
  messages: readonly PersistedChatMessage[]
): PersistedChatMessage[] | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, serialize(messages));
    return [...messages];
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
    return textOnly;
  } catch {
    // The text-only retry also failed (storage disabled entirely, e.g.
    // private browsing) — nothing more can be done without losing text, so
    // give up silently rather than throwing out of a persistence side-effect.
    return null;
  }
}

/** Persists the conversation. Fails silently beyond the retry above. */
function saveToStorage(messages: readonly PersistedChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const written = writeToStorage(fitToByteBudget(messages));
    // Only overwrite the cache when a write actually landed — see the
    // module-scope cache's doc comment. If both attempts above failed,
    // storage is unchanged, so the cache must stay unchanged too (writing
    // `written` here, `null`, would otherwise make a later read think the
    // conversation was cleared).
    if (written !== null) {
      cachedSnapshot = written;
    }
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
// that contract and be wasteful.
//
// `subscribe` is a no-op (this hook is the sole writer, and nothing external
// notifies us of changes), but the module stays loaded across an App Router
// soft-navigation remount (/assistant -> /transactions -> /assistant) — so
// without active upkeep, `cachedSnapshot` would silently go stale the moment
// `persist` writes something new, and the restore effect would then hand the
// STALE snapshot back to `setMessages`, wiping the real (newer) conversation
// out of the UI, and the following persist effect would write that stale
// list right back over the good data in localStorage. Two rules keep this
// from happening within a single tab (multi-tab sync is out of scope):
//  1. `saveToStorage` sets `cachedSnapshot` to exactly what
//     `writeToStorage` reports actually landed in storage, every time a
//     write succeeds (see both functions' doc comments) — so a remounted
//     consumer's very first `getClientSnapshot()` call sees the latest data
//     instead of whatever was cached at last module load.
//  2. `clear()` resets the cache to `undefined` — the same "not yet read"
//     sentinel `getClientSnapshot` checks for below — rather than `null`
//     (a legitimate "storage was checked and is empty" value). `null` would
//     permanently short-circuit `getClientSnapshot`'s `if` guard, so
//     storage would never be re-read again for the rest of the page's
//     lifetime even after something new was persisted.
// ---------------------------------------------------------------------------

const NOT_YET_HYDRATED = Symbol("chat-persistence-not-yet-hydrated");

type Snapshot = PersistedChatMessage[] | null | typeof NOT_YET_HYDRATED;

/**
 * `undefined` means "not yet read from storage this module lifetime" (see
 * `getClientSnapshot`); `null` means "read, and there's nothing there" — a
 * real, cacheable result in its own right, not a sentinel.
 */
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
    // `undefined`, not `null` — see the module-scope cache's doc comment:
    // this must be the "re-read on next access" sentinel, not the cached
    // "storage is empty" result, or a later write elsewhere in the module's
    // lifetime would never be picked up again.
    cachedSnapshot = undefined;
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
