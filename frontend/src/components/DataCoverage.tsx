import { useEffect, useState } from "react";
import { Paper, Title, Table, Text, Badge, Group } from "@mantine/core";
import api from "../api/client";
import type { AccountCoverage } from "../types";

interface Props {
  refreshKey: number;
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  // Compare dates only (no time)
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function freshnessColor(days: number): string {
  if (days <= 7) return "green";
  if (days <= 30) return "yellow";
  return "red";
}

export default function DataCoverage({ refreshKey }: Props) {
  const [rows, setRows] = useState<AccountCoverage[]>([]);

  useEffect(() => {
    api.get("/account-coverage").then((res) => setRows(res.data));
  }, [refreshKey]);

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Account Coverage</Title>
        <Text size="xs" c="dimmed">
          Latest transaction recorded per bank/account
        </Text>
      </Group>
      {rows.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          No transactions yet — upload a CSV to get started.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={680}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Bank</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Latest Date</Table.Th>
              <Table.Th>Earliest Date</Table.Th>
              <Table.Th style={{ textAlign: "right" }}>Transactions</Table.Th>
              <Table.Th>Freshness</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const days = daysSince(r.latest_date);
              return (
                <Table.Tr key={`${r.bank}|${r.account}`}>
                  <Table.Td>
                    <Badge variant="light" size="sm">{r.bank}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.account}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.latest_date}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{r.earliest_date}</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Text size="sm" fw={500}>{r.count}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm" color={freshnessColor(days)}>
                      {days === 0 ? "Today" : `${days}d ago`}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
