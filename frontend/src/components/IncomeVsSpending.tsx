import { Paper, Title, Text } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";
import type { IncomeVsSpending as IvsS } from "../types";

interface Props {
  data: IvsS[];
}

export default function IncomeVsSpending({ data }: Props) {
  if (data.length === 0) {
    return (
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">Income vs Spending</Title>
        <Text c="dimmed" ta="center" py="xl">No data yet</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Title order={4} mb="sm">Income vs Spending</Title>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(v) => `$${Math.abs(v).toLocaleString()}`} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const label = name === "difference"
                ? (value >= 0 ? "Surplus" : "Deficit")
                : name.charAt(0).toUpperCase() + name.slice(1);
              return [`$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, label];
            }}
          />
          <Legend />
          <ReferenceLine y={0} stroke="#666" />
          <Bar dataKey="income" fill="#12b886" radius={[4, 4, 0, 0]} />
          <Bar dataKey="spending" fill="#fa5252" radius={[4, 4, 0, 0]} />
          <Bar dataKey="difference" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.difference >= 0 ? "#4c6ef5" : "#e64980"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}
