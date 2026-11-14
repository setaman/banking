import React from "react";
import { addons, types } from "storybook/manager-api";

import { Panel } from "./addons/ai-chat/Panel";

addons.setConfig({ panelPosition: "right" });

addons.register("ai-chat", (api) => {
  addons.add("ai-chat/panel", {
    type: types.PANEL,
    title: "AI Chat",
    // Sort before the built-in panels (Controls/Actions/Interactions).
    order: -100,
    render: ({ active }) => <Panel active={!!active} api={api} />,
  });

  // Select AI Chat on first load unless the URL explicitly picks a panel.
  const select = (): void => {
    if (new URLSearchParams(window.location.search).has("addonPanel")) return;
    api.setSelectedPanel("ai-chat/panel");
  };
  api.once("storyRendered", select);
});
