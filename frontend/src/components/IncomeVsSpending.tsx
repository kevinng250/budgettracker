import { useState } from "react";
import {
  Paper,
  Title,
  Text,
  Group,
  Select,
  SegmentedControl,
  SimpleGrid,
} from "@mantine/core";
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";
import { useIncomeVsSpending } from "../hooks/useSummary";
import { useActiveProfile } from "../context/ActiveProfile";
import type { Category } from "../types";

interface Props {
  categories?: Category[];
}

const RANGES = [
  { label: "3m", value: "3" },
  { label: "6m", value: "6" },
  { label: "12m", value: "12" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function computeRange(key: string): { from?: string; to?: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const todayStr = `${y}-${pad(m + 1)}-${pad(d)}`;

  if (key === "all") return {};
  if (key === "ytd") return { from: `${y}-01-01`, to: todayStr };

  const months = Number(key);
  if (Number.isFinite(months) && months > 0) {
    const from = new Date(y, m - months + 1, 1);
    const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`;
    return { from: fromStr, to: todayStr };
  }
  return {};
}

function formatShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `$${(v / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `$${v.toFixed(0)}`;
}

function formatFull(v: number): string {
  return `$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const COLOR_INCOME = "#12b886";
const COLOR_SPENDING = "#fa5252";
const COLOR_NET_POS = "#4c6ef5";
const COLOR_NET_NEG = "#e64980";

export default function IncomeVsSpending({ categories = [] }: Props) {
  const [rangeKey, setRangeKey] = useState("6");
  const [category, setCategory] = useState("");
  const { activeProfileId } = useActiveProfile();

  const { from, to } = computeRange(rangeKey);
  const { data } = useIncomeVsSpending(from, to, category || undefined, activeProfileId);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalSpending = data.reduce((s, d) => s + d.spending, 0);
  const totalNet = totalIncome - totalSpending;
  const netColor = totalNet >= 0 ? "blue" : "pink";

  const showFilter = categories.length > 0;
  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
    { value: "Uncategorized", label: "Uncategorized" },
  ];

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Title order={4}>Income vs Spending</Title>
        <Group gap="xs" wrap="wrap">
          <SegmentedControl
            size="xs"
            value={rangeKey}
            onChange={setRangeKey}
            data={RANGES}
          />
          {showFilter && (
            <Select
              size="xs"
              w={170}
              data={categoryOptions}
              value={category}
              onChange={(v) => setCategory(v || "")}
              allowDeselect={false}
              placeholder="All categories"
            />
          )}
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 3, xs: 3 }} mb="md" spacing="sm">
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" c="dimmed">Income</Text>
          <Text size="lg" fw={700} c="teal">
            {formatFull(totalIncome)}
          </Text>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" c="dimmed">Spending</Text>
          <Text size="lg" fw={700} c="red">
            {formatFull(totalSpending)}
          </Text>
        </Paper>
        <Paper p="sm" radius="md" withBorder>
          <Text size="xs" c="dimmed">{totalNet >= 0 ? "Surplus" : "Deficit"}</Text>
          <Text size="lg" fw={700} c={netColor}>
            {totalNet >= 0 ? "+" : "-"}{formatFull(totalNet)}
          </Text>
        </Paper>
      </SimpleGrid>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No data in this range.
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatShort} width={60} />
            <Tooltip
              formatter={(value: number, name: string) => {
                const key = String(name);
                const label =
                  key === "Net"
                    ? value >= 0
                      ? "Net (surplus)"
                      : "Net (deficit)"
                    : key;
                return [formatFull(value), label];
              }}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                backgroundColor: "var(--mantine-color-body)",
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 6,
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 8 }} />
            <ReferenceLine y={0} stroke="var(--mantine-color-gray-5)" />
            <Bar
              dataKey="income"
              name="Income"
              fill={COLOR_INCOME}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
            <Bar
              dataKey="spending"
              name="Spending"
              fill={COLOR_SPENDING}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
            <Line
              dataKey="difference"
              name="Net"
              type="monotone"
              stroke={totalNet >= 0 ? COLOR_NET_POS : COLOR_NET_NEG}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const fill = payload?.difference >= 0 ? COLOR_NET_POS : COLOR_NET_NEG;
                return (
                  <circle
                    key={`net-dot-${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={fill}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
