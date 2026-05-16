import { useState, useEffect } from "react";
import { Paper, Title, Table, Badge, Text, Group, Select, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { UploadLogEntry, BankAccount } from "../types";

interface Props {
  bankAccounts: BankAccount[];
  refreshKey: number;
  onDeleted?: () => void;
}

export default function UploadLog({ bankAccounts, refreshKey, onDeleted }: Props) {
  const [logs, setLogs] = useState<UploadLogEntry[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/upload-log").then((res) => setLogs(res.data));
  }, [refreshKey]);

  const filtered = filter
    ? logs.filter((l) => `${l.bank}|${l.account}` === filter)
    : logs;

  // Group by bank|account and compute merged date ranges
  const coverageByAccount: Record<string, { min: string; max: string }> = {};
  for (const log of logs) {
    const key = `${log.bank} - ${log.account}`;
    if (!coverageByAccount[key]) {
      coverageByAccount[key] = { min: log.date_min, max: log.date_max };
    } else {
      if (log.date_min < coverageByAccount[key].min)
        coverageByAccount[key].min = log.date_min;
      if (log.date_max > coverageByAccount[key].max)
        coverageByAccount[key].max = log.date_max;
    }
  }

  const filterOptions = [
    { value: "", label: "All Accounts" },
    ...bankAccounts.map((ba) => ({
      value: `${ba.bank}|${ba.account}`,
      label: `${ba.bank} - ${ba.account}`,
    })),
  ];

  const handleDelete = async (log: UploadLogEntry) => {
    if (!window.confirm(
      `Delete this upload? It will remove ${log.inserted} transaction${log.inserted === 1 ? "" : "s"} ` +
      `from ${log.bank} - ${log.account} between ${log.date_min} and ${log.date_max}.`
    )) return;
    try {
      await api.delete(`/upload-log/${log.id}`);
      onDeleted?.();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to delete upload",
        color: "red",
      });
    }
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Upload History</Title>
        <Select
          placeholder="Filter by account"
          value={filter}
          onChange={(v) => setFilter(v || "")}
          data={filterOptions}
          size="xs"
          w={220}
          allowDeselect={false}
        />
      </Group>

      {Object.keys(coverageByAccount).length > 0 && (
        <Group gap="sm" mb="md" wrap="wrap">
          {Object.entries(coverageByAccount).map(([acct, range]) => (
            <Badge key={acct} variant="light" size="lg" radius="sm">
              {acct}: {range.min} to {range.max}
            </Badge>
          ))}
        </Group>
      )}

      {filtered.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          No uploads yet
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={720}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>File</Table.Th>
              <Table.Th>Bank</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Date Range</Table.Th>
              <Table.Th>Transactions</Table.Th>
              <Table.Th>Uploaded At</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.map((log) => (
              <Table.Tr key={log.id}>
                <Table.Td>
                  <Text size="sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.filename}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">{log.bank}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{log.account}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{log.date_min} to {log.date_max}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{log.inserted}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{log.uploaded_at}</Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(log)}
                    aria-label="Delete upload batch"
                    title="Delete this upload's transactions"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}
