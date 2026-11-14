import type { StorybookConfig } from "@storybook/nextjs-vite";

import { sourceTagPlugin } from "./source-tag-plugin";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  // Our plugin must run before the framework's own TS/JSX transforms, so it is
  // placed first in the plugin list rather than appended via mergeConfig.
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: [sourceTagPlugin(), ...(viteConfig.plugins ?? [])],
  }),
};

export default config;
