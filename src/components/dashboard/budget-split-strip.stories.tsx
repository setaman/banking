import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BudgetSplitStrip } from "./budget-split-strip";

const meta = {
  title: "Dashboard/BudgetSplitStrip",
  component: BudgetSplitStrip,
} satisfies Meta<typeof BudgetSplitStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {
  args: {
    result: {
      needs: 1500,
      wants: 900,
      saved: 600,
      needsPercentage: 50,
      wantsPercentage: 30,
      savedPercentage: 20,
      deficit: 0,
    },
  },
};

export const Deficit: Story = {
  args: {
    result: {
      needs: 2200,
      wants: 1200,
      saved: 0,
      needsPercentage: 64.7,
      wantsPercentage: 35.3,
      savedPercentage: 0,
      deficit: -400,
    },
  },
};
