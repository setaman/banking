/**
 * use-scenarios — client-side hook for managing named What-If sandbox scenarios.
 *
 * Scenarios are persisted to localStorage under `STORAGE_KEY` and survive
 * page reloads. A default empty scenario is created automatically on first
 * use. The hook is SSR-safe: localStorage is only accessed inside the lazy
 * `useState` initialiser, which runs only on the client.
 *
 * This hook never reads from or writes to the database. It is read-only with
 * respect to banking data.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ScenarioRule } from "@/lib/stats/sandbox-projector";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "banking:sandbox:scenarios:v1";
const DEFAULT_SCENARIO_ID = "default";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly rules: ScenarioRule[];
}

export type ScenariosMap = Record<string, Scenario>;

export interface UseScenariosReturn {
  /** All persisted named scenarios, keyed by id. */
  readonly scenarios: ScenariosMap;
  /** The currently active scenario id (default: "default"). */
  readonly activeScenarioId: string;
  /** Switch the active scenario. */
  setActiveScenarioId: (id: string) => void;
  /** Add a rule to the active scenario. Generates a fresh UUID for the rule. */
  addRule: (rule: Omit<ScenarioRule, "id">) => void;
  /** Patch one or more fields of an existing rule in the active scenario. */
  updateRule: (id: string, patch: Partial<Omit<ScenarioRule, "id">>) => void;
  /** Remove a rule by id from the active scenario. */
  removeRule: (id: string) => void;
  /** Persist the active scenario's rules as a new named scenario. */
  saveAsNew: (name: string) => void;
  /** Rename an existing scenario. */
  renameScenario: (id: string, name: string) => void;
  /** Delete a scenario by id. Falls back to "default" if the active one is deleted. */
  deleteScenario: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultScenario(): Scenario {
  return {
    id: DEFAULT_SCENARIO_ID,
    name: "Default",
    rules: [],
  };
}

function buildInitialState(): ScenariosMap {
  return { [DEFAULT_SCENARIO_ID]: createDefaultScenario() };
}

/**
 * Attempts to read and parse the scenarios map from localStorage.
 * Returns `null` when running on the server, when the key is absent, or
 * when the stored value is not a plain object.
 */
function loadFromStorage(): ScenariosMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as ScenariosMap;
  } catch {
    return null;
  }
}

/**
 * Persists the scenarios map to localStorage. Fails silently (quota exceeded
 * or private-browsing restriction).
 */
function saveToStorage(scenarios: ScenariosMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {
    // Intentionally silent.
  }
}

/**
 * Lazy initialiser for the `scenarios` useState call. Runs once on the
 * client, reads from localStorage, and ensures the default scenario exists.
 */
function initScenarios(): ScenariosMap {
  const stored = loadFromStorage();
  if (stored === null) return buildInitialState();

  // Ensure the default scenario always exists after hydration.
  if (!stored[DEFAULT_SCENARIO_ID]) {
    return { [DEFAULT_SCENARIO_ID]: createDefaultScenario(), ...stored };
  }
  return stored;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages multiple named What-If scenarios, each holding an array of
 * `ScenarioRule` objects. State is hydrated from and persisted to
 * localStorage on every change.
 */
export function useScenarios(): UseScenariosReturn {
  // Lazy initialiser reads from localStorage on first render (client only).
  const [scenarios, setScenarios] = useState<ScenariosMap>(initScenarios);
  const [activeScenarioId, setActiveScenarioIdState] =
    useState<string>(DEFAULT_SCENARIO_ID);

  // Track whether this is the first render so we skip the initial persist
  // (no point writing back what we just read).
  const isFirstRender = useRef(true);

  // Persist to localStorage whenever scenarios change, skipping the mount.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveToStorage(scenarios);
  }, [scenarios]);

  // ---------------------------------------------------------------------------
  // Setters
  // ---------------------------------------------------------------------------

  const setActiveScenarioId = useCallback((id: string): void => {
    setActiveScenarioIdState(id);
  }, []);

  const addRule = useCallback(
    (rule: Omit<ScenarioRule, "id">): void => {
      const id = crypto.randomUUID();
      const newRule: ScenarioRule = { ...rule, id } as ScenarioRule;
      setScenarios((prev) => {
        const active = prev[activeScenarioId];
        if (!active) return prev;
        return {
          ...prev,
          [activeScenarioId]: {
            ...active,
            rules: [...active.rules, newRule],
          },
        };
      });
    },
    [activeScenarioId]
  );

  const updateRule = useCallback(
    (ruleId: string, patch: Partial<Omit<ScenarioRule, "id">>): void => {
      setScenarios((prev) => {
        const active = prev[activeScenarioId];
        if (!active) return prev;
        return {
          ...prev,
          [activeScenarioId]: {
            ...active,
            rules: active.rules.map((r) =>
              r.id === ruleId ? ({ ...r, ...patch } as ScenarioRule) : r
            ),
          },
        };
      });
    },
    [activeScenarioId]
  );

  const removeRule = useCallback(
    (ruleId: string): void => {
      setScenarios((prev) => {
        const active = prev[activeScenarioId];
        if (!active) return prev;
        return {
          ...prev,
          [activeScenarioId]: {
            ...active,
            rules: active.rules.filter((r) => r.id !== ruleId),
          },
        };
      });
    },
    [activeScenarioId]
  );

  const saveAsNew = useCallback(
    (name: string): void => {
      const newId = crypto.randomUUID();
      setScenarios((prev) => {
        const active = prev[activeScenarioId];
        if (!active) return prev;
        const newScenario: Scenario = {
          id: newId,
          name,
          // Deep-copy rules so the new scenario is independent.
          rules: active.rules.map((r) => ({ ...r })),
        };
        return { ...prev, [newId]: newScenario };
      });
      setActiveScenarioIdState(newId);
    },
    [activeScenarioId]
  );

  const renameScenario = useCallback((id: string, name: string): void => {
    setScenarios((prev) => {
      const target = prev[id];
      if (!target) return prev;
      return { ...prev, [id]: { ...target, name } };
    });
  }, []);

  const deleteScenario = useCallback((id: string): void => {
    // The default scenario cannot be deleted.
    if (id === DEFAULT_SCENARIO_ID) return;
    setScenarios((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // If the deleted scenario was active, fall back to default.
    setActiveScenarioIdState((prev) =>
      prev === id ? DEFAULT_SCENARIO_ID : prev
    );
  }, []);

  return {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    addRule,
    updateRule,
    removeRule,
    saveAsNew,
    renameScenario,
    deleteScenario,
  };
}
