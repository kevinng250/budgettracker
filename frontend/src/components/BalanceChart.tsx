import { useState, useEffect } from "react";
import { Paper, Title, Text, Select, Group } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useBalanceHistory } from "../hooks/useSummary";
import api from "../api/client";
import type { BankAccount } from "../types";

const COLORS = ["#4c6ef5", "#12b886", "#fa5252", "#fab005", "#7950f2", "#fd7e14", "#20c997", "#e64980"];

export default function BalanceChart() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selected, setSelected] = useState("__all__");

  useEffect(() => {
    api.get("/banks-with-balances").then((res) => {
      setAccounts(res.data);
    });
  }, []);

  const bank = selected !== "__all__" ? selected.split("|")[0] : undefined;
  const account = selected !== "__all__" ? selected.split("|")[1] : undefined;
  const { data } = useBalanceHistory(bank, account);

  const options = [
    { value: "__all__", label: "All Accounts" },
    ...accounts.map((ba) => ({
      value: `${ba.bank}|${ba.account}`,
      label: `${ba.bank} - ${ba.account}`,
    })),
  ];

  // For "All Accounts", pivot data into { date, "Bank - Account1": balance, "Bank - Account2": balance, ... }
  const isAll = selected === "__all__";
  const accountKeys: string[] = [];
  let chartData: Record<string, any>[] = [];

  if (isAll && data.length > 0) {
    const dateMap = new Map<string, Record<string, any>>();
    const keySet = new Set<string>();

    for (const pt of data) {
      const key = `${pt.bank} - ${pt.account}`;
      keySet.add(key);
      if (!dateMap.has(pt.date)) {
        dateMap.set(pt.date, { date: pt.date });
      }
      dateMap.get(pt.date)![key] = pt.balance;
    }

    accountKeys.push(...Array.from(keySet));
    chartData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Forward-fill: carry forward last known balance for each account
    const lastKnown: Record<string, number> = {};
    for (const row of chartData) {
      for (const key of accountKeys) {
        if (row[key] != null) {
          lastKnown[key] = row[key];
        } else if (lastKnown[key] != null) {
          row[key] = lastKnown[key];
        }
      }
      // Compute total across all accounts with known balances
      let total = 0;
      let hasAny = false;
      for (const key of accountKeys) {
        if (row[key] != null) {
          total += row[key];
          hasAny = true;
        }
      }
      if (hasAny) row["Total"] = total;
    }
  } else {
    chartData = data;
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Account Balance Over Time</Title>
        <Select
          value={selected}
          onChange={(v) => setSelected(v || "__all__")}
          data={options}
          size="xs"
          w={240}
        />
      </Group>
      {chartData.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No balance data available
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(v) => `$${v.toLocaleString()}`} />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
            {isAll ? (
              <>
                <Legend />
                <Line
                  key="Total"
                  type="monotone"
                  dataKey="Total"
                  stroke="#333"
                  dot={false}
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  connectNulls
                />
                {accountKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
              </>
            ) : (
              <Line type="monotone" dataKey="balance" stroke="#4c6ef5" dot={false} strokeWidth={2} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
