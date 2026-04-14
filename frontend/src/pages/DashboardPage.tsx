import { useState } from "react";
import { Title, SimpleGrid, Paper, Text, SegmentedControl, Group } from "@mantine/core";
import SpendingByTag from "../components/SpendingByTag";
import SpendingOverTime from "../components/SpendingOverTime";
import IncomeVsSpending from "../components/IncomeVsSpending";
import BalanceChart from "../components/BalanceChart";
import AccountBalances from "../components/AccountBalances";
import { useSpendingByTag, useSpendingOverTime, useIncomeVsSpending } from "../hooks/useSummary";

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default function DashboardPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [mode, setMode] = useState("net");

  const { from, to } = getMonthRange(month);

  const { data: byTag } = useSpendingByTag(from, to, mode);
  const { data: overTime } = useSpendingOverTime(undefined, undefined, "month", mode);
  const { data: incomeVsSpending } = useIncomeVsSpending();

  const totalSpending = byTag.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = byTag.reduce((sum, t) => sum + t.count, 0);
  const topCategory = byTag.length > 0 ? byTag[0] : null;

  const prevMonth = () =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Dashboard</Title>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          data={[
            { label: "Gross", value: "gross" },
            { label: "Net", value: "net" },
          ]}
          size="sm"
        />
      </Group>

      <SimpleGrid cols={{ base: 1 }} mb="md">
        <IncomeVsSpending data={incomeVsSpending} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">
            {mode === "gross" ? "Monthly Spending" : "Monthly Net"}
          </Text>
          <Text size="xl" fw={700}>${totalSpending.toFixed(2)}</Text>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">Transactions</Text>
          <Text size="xl" fw={700}>{totalTransactions}</Text>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">Top Category</Text>
          <Text size="xl" fw={700}>
            {topCategory ? `${topCategory.tag} ($${topCategory.total.toFixed(2)})` : "N/A"}
          </Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <SpendingByTag
          data={byTag}
          month={month}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
        <SpendingOverTime data={overTime} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <AccountBalances />
        <BalanceChart />
      </SimpleGrid>
    </>
  );
}
