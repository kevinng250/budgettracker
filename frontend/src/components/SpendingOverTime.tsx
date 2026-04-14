import { Paper, Title, Text } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SpendingOverTime as SpendingOverTimeType } from "../types";

interface Props {
  data: SpendingOverTimeType[];
}

export default function SpendingOverTime({ data }: Props) {
  if (data.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">Spending Over Time</Title>
        <Text c="dimmed" ta="center" py="xl">No spending data yet</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="sm">Spending Over Time</Title>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
          <Bar dataKey="total" fill="#4c6ef5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
