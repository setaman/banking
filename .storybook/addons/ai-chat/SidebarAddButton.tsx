/* Sidebar story label with a hover "add to Composer" button (renderLabel). */
import React, { useEffect, useState } from "react";
import type { API } from "storybook/manager-api";

import { addStoryToBasket, COMPOSER_ADD_EVENT, loadBasket, repoPath } from "./composer";

const STYLE_ID = "ai-chat-sidebar-style";
const CSS = `
.ai-chat-add{opacity:0;margin-left:auto;margin-right:30px;flex:none;border:0;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:11px;line-height:1;padding:2px 4px;transition:opacity .12s}
[data-item-id]:hover .ai-chat-add,[data-selected="true"] .ai-chat-add,.ai-chat-add[data-selected="true"],.ai-chat-add[data-added="true"],.ai-chat-add:focus-visible{opacity:.85}
.ai-chat-add:hover{opacity:1!important;background:rgba(128,128,128,.25)}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

interface Entry {
  id: string;
  type: string;
  title: string;
  name: string;
  importPath?: string;
  initialArgs?: Record<string, unknown>;
}

function AddButton({ id, api, selected }: { id: string; api: API; selected: boolean }): React.ReactElement {
  const inBasket = (): boolean => loadBasket().stories.some((s) => s.id === id);
  const [added, setAdded] = useState(inBasket);
  useEffect(() => {
    const sync = (): void => setAdded(inBasket());
    window.addEventListener(COMPOSER_ADD_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COMPOSER_ADD_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onClick = (e: React.SyntheticEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const entry = api.getData(id) as unknown as Entry | undefined;
    if (!entry || entry.type !== "story" || added) return;
    const ok = addStoryToBasket({
      id: entry.id,
      title: entry.title,
      name: entry.name,
      importPath: repoPath(entry.importPath ?? ""),
      args: entry.initialArgs ?? {},
      globals: {},
    });
    setAdded(true);
    if (ok)
      api.addNotification({
        id: `ai-chat-added-${id}-${Date.now()}`,
        content: { headline: `Added '${entry.name}' to Composer`, subHeadline: entry.title },
        duration: 2500,
      });
  };

  return (
    <span
      role="button"
      tabIndex={0}
      className="ai-chat-add"
      data-selected={selected ? "true" : undefined}
      data-added={added ? "true" : undefined}
      title={added ? "In Composer" : "Add to Composer"}
      aria-label={added ? "In Composer" : "Add to Composer"}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(e);
      }}
    >
      {added ? "✓" : "+🧩"}
    </span>
  );
}

export function renderSidebarLabel(item: { id: string; type: string; name: string }, api: API): React.ReactNode {
  ensureStyle();
  if (item.type !== "story") return item.name;
  const selected = api.getUrlState().storyId === item.id;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", minWidth: 0 }}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
      <AddButton id={item.id} api={api} selected={selected} />
    </span>
  );
}
