import { Paper, Title, Text, Group, Select } from "@mantine/core";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SpendingOverTime as SpendingOverTimeType, Category } from "../types";

interface Props {
  data: SpendingOverTimeType[];
  title?: string;
  color?: string;
  category?: string;
  onCategoryChange?: (v: string) => void;
  categories?: Category[];
}

export default function SpendingOverTime({
  data,
  title = "Spending Over Time",
  color = "#4c6ef5",
  category,
  onCategoryChange,
  categories,
}: Props) {
  const showFilter = !!onCategoryChange && !!categories;
  const categoryOptions = showFilter
    ? [
        { value: "", label: "All Categories" },
        ...categories!.map((c) => ({ value: c.name, label: c.name })),
        { value: "Uncategorized", label: "Uncategorized" },
      ]
    : [];

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>{title}</Title>
        {showFilter && (
          <Select
            size="xs"
            w={180}
            data={categoryOptions}
            value={category ?? ""}
            onChange={(v) => onCategoryChange!(v || "")}
            allowDeselect={false}
          />
        )}
      </Group>
      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No data yet</Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
