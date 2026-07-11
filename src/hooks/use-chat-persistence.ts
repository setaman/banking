/**
 * use-chat-persistence — client-side hook for persisting the AI Assistant's
 * single conversation to localStorage.
 *
 * SSR-safe: localStorage is only ever touched inside the lazy `useState`
 * initialiser (client-only) and inside imperative callbacks, following the
 * same pattern as `useScenarios` (`src/hooks/use-scenarios.ts`). The very
 * first `persist()` call (the initial mount, which would just write back
 * what was just read) is skipped via a ref guard.
 *
 * Only plain text content + minimal metadata (id, role, timestamp) is
 * persisted — never tool-call state, streaming flags, or visualizations
 * (those are re-derived from the persisted Markdown text on render).
 */
"use client";

import { useCallback, useRef, useState } from "react";
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
  /** UI messages hydrated from localStorage, ready to seed `useChat`. */
  readonly initialMessages: UIMessage[];
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
// Hook
// ---------------------------------------------------------------------------

export function useChatPersistence(): UseChatPersistenceReturn {
  // Lazy initialiser — reads localStorage once, on the client only.
  const [initState] = useState<{
    messages: UIMessage[];
    timestamps: Map<string, string>;
  }>(() => {
    const stored = loadFromStorage();
    const timestamps = new Map<string, string>();
    if (!stored) {
      return { messages: [], timestamps };
    }
    for (const m of stored) {
      timestamps.set(m.id, m.timestamp);
    }
    return { messages: stored.map(toUIMessage), timestamps };
  });

  const timestampsRef = useRef<Map<string, string>>(initState.timestamps);
  const isFirstPersist = useRef(true);

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
        // just read (or an empty conversation), mirroring useScenarios.
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
  }, []);

  return {
    initialMessages: initState.messages,
    persist,
    getTimestamp,
    clear,
  };
}
