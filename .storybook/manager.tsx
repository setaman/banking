import React from "react";
import { addons, types } from "storybook/manager-api";

import { Panel } from "./addons/ai-chat/Panel";

addons.setConfig({ panelPosition: "right" });

addons.register("ai-chat", (api) => {
  addons.add("ai-chat/panel", {
    type: types.PANEL,
    title: "AI Chat",
    render: ({ active }) => <Panel active={!!active} api={api} />,
  });
});
