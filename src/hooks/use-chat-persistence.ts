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
 * Only plain text content + minimal metadata (id, role, timestamp) is
 * persisted — never tool-call state, streaming flags, or visualizations
 * (those are re-derived from the persisted Markdown text on render).
 */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { UIMessage } from "ai";

const STORAGE_KEY = "banking:assistant:conversation:v1";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PersistedChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
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
// Helpers
// ---------------------------------------------------------------------------

function isPersistedChatMessage(value: unknown): value is PersistedChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    typeof candidate.timestamp === "string"
  );
}

/**
 * Attempts to read and validate the persisted conversation from
 * localStorage. Returns `null` on the server, when the key is absent, or
 * when the stored value fails shape validation.
 */
function loadFromStorage(): PersistedChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as { messages?: unknown }).messages)
    ) {
      return null;
    }
    const { messages } = parsed as PersistedConversation;
    return messages.every(isPersistedChatMessage) ? messages : null;
  } catch {
    return null;
  }
}

/** Persists the conversation. Fails silently (quota / private browsing). */
function saveToStorage(messages: readonly PersistedChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedConversation = {
      messages: [...messages],
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Intentionally silent.
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

/** Joins every `text` part of a UI message into a single Markdown string. */
function extractTextContent(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function toUIMessage(message: PersistedChatMessage): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
  };
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
      const toStore: PersistedChatMessage[] = messages
        .filter(
          (m): m is UIMessage & { role: "user" | "assistant" } =>
            m.role === "user" || m.role === "assistant"
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: extractTextContent(m),
          timestamp: getTimestamp(m.id),
        }));
      saveToStorage(toStore);
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
