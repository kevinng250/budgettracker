import { useState } from "react";
import { Title, SimpleGrid, Paper, Text, SegmentedControl, Group } from "@mantine/core";
import SpendingByTag from "../components/SpendingByTag";
import SpendingOverTime from "../components/SpendingOverTime";
import IncomeVsSpending from "../components/IncomeVsSpending";
import BalanceChart from "../components/BalanceChart";
import AccountBalances from "../components/AccountBalances";
import { useSpendingByTag, useSpendingOverTime } from "../hooks/useSummary";
import { useCategories } from "../hooks/useCategories";
import { useActiveProfile } from "../context/ActiveProfile";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function getYearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function getYTDRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  return {
    from: `${y}-01-01`,
    to: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("month");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [mode, setMode] = useState("gross");
  const [groupBy, setGroupBy] = useState("tag");
  const [overTimeCategory, setOverTimeCategory] = useState("");

  const { categories } = useCategories();
  const { activeProfileId } = useActiveProfile();

  // Compute date range based on period
  let from: string, to: string, periodLabel: string;
  if (period === "year") {
    ({ from, to } = getYearRange(year));
    periodLabel = String(year);
  } else if (period === "ytd") {
    ({ from, to } = getYTDRange());
    periodLabel = `${new Date().getFullYear()} YTD`;
  } else {
    ({ from, to } = getMonthRange(month));
    periodLabel = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  }

  // For "net" mode, we need both gross spending and income to compute the difference
  const apiMode = mode === "net" ? "gross" : mode;
  // Income mode aggregates per source description, so groupBy doesn't apply.
  const effectiveGroupBy = mode === "income" ? "tag" : groupBy;
  const { data: byTag } = useSpendingByTag(from, to, apiMode, effectiveGroupBy, activeProfileId);
  // Income totals are always grouped by source for KPI math; not affected by toggle
  const { data: incomeByTag } = useSpendingByTag(from, to, "income", "tag", activeProfileId);

  const timeFrom = period === "month" ? undefined : from;
  const timeTo = period === "month" ? undefined : to;
  const { data: overTime } = useSpendingOverTime(
    timeFrom, timeTo, "month", apiMode, overTimeCategory || undefined, activeProfileId
  );

  const totalGross = byTag.reduce((sum, t) => sum + t.total, 0);
  const totalIncome = incomeByTag.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = byTag.reduce((sum, t) => sum + t.count, 0);
  const topCategory = byTag.length > 0 ? byTag[0] : null;

  // Display values based on mode
  const displayTotal = mode === "net" ? totalIncome - totalGross : mode === "income" ? totalIncome : totalGross;
  const displayByTag = mode === "income" ? incomeByTag : byTag;

  const prevPeriod = () => {
    if (period === "month") {
      setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    } else if (period === "year") {
      setYear((y) => y - 1);
    }
  };
  const nextPeriod = () => {
    if (period === "month") {
      setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    } else if (period === "year") {
      setYear((y) => y + 1);
    }
  };

  const modeLabels: Record<string, Record<string, string>> = {
    month: { gross: "Monthly Spending", net: "Monthly Net", income: "Monthly Income" },
    year: { gross: "Yearly Spending", net: "Yearly Net", income: "Yearly Income" },
    ytd: { gross: "YTD Spending", net: "YTD Net", income: "YTD Income" },
  };
  const spendingLabel = modeLabels[period]?.[mode] || "Spending";

  const isNetNegative = mode === "net" && displayTotal < 0;
  const formattedTotal = mode === "net"
    ? `${displayTotal < 0 ? "-" : ""}$${Math.abs(displayTotal).toFixed(2)}`
    : `$${displayTotal.toFixed(2)}`;

  const topLabel = mode === "income"
    ? "Top Source"
    : effectiveGroupBy === "category" ? "Top Category" : "Top Tag";

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Dashboard</Title>
        <Group gap="sm">
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            data={[
              { label: "Monthly", value: "month" },
              { label: "Yearly", value: "year" },
              { label: "YTD", value: "ytd" },
            ]}
            size="sm"
          />
          <SegmentedControl
            value={mode}
            onChange={setMode}
            data={[
              { label: "Gross", value: "gross" },
              { label: "Net", value: "net" },
              { label: "Income", value: "income" },
            ]}
            size="sm"
          />
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1 }} mb="md">
        <IncomeVsSpending categories={categories} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">{spendingLabel}</Text>
          <Text size="xl" fw={700} c={isNetNegative ? "red" : undefined}>
            {formattedTotal}
          </Text>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">Transactions</Text>
          <Text size="xl" fw={700}>{totalTransactions}</Text>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">{topLabel}</Text>
          <Text size="xl" fw={700}>
            {topCategory ? `${topCategory.tag} ($${topCategory.total.toFixed(2)})` : "N/A"}
          </Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <SpendingByTag
          data={displayByTag}
          month={month}
          onPrev={prevPeriod}
          onNext={nextPeriod}
          periodLabel={period !== "month" ? periodLabel : undefined}
          hideNav={period === "ytd"}
          showDailyAvg={period === "month" && mode === "gross"}
          groupBy={effectiveGroupBy}
          onGroupByChange={mode === "income" ? undefined : setGroupBy}
        />
        <SpendingOverTime
          data={overTime}
          title={mode === "income" ? "Income Over Time" : "Spending Over Time"}
          color={mode === "income" ? "#12b886" : "#4c6ef5"}
          category={overTimeCategory}
          onCategoryChange={setOverTimeCategory}
          categories={categories}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <AccountBalances />
        <BalanceChart />
      </SimpleGrid>
    </>
  );
}
