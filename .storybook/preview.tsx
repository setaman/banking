import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";
import "./addons/ai-chat/picker";
import { recordStory } from "./addons/ai-chat/picker";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
  },
  decorators: [
    (Story, context) => {
      recordStory({
        id: context.id,
        title: context.title,
        name: context.name,
        args: context.args,
      });
      return <Story />;
    },
    (Story) => (
      <div className="dark bg-background text-foreground min-h-screen p-6">
        <Story />
      </div>
    ),
  ],
};

export default preview;
