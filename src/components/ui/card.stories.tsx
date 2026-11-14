import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card className="w-96" {...args}>
      <CardHeader>
        <CardTitle>Checking account</CardTitle>
        <CardDescription>Available balance</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">EUR 4,250.00</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">View transactions</Button>
      </CardFooter>
    </Card>
  ),
};
