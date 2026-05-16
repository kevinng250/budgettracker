import { useEffect, useState } from "react";
import {
  Title,
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  ActionIcon,
  Button,
  SimpleGrid,
  Table,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import TransactionTable from "../components/TransactionTable";
import { useTransactions } from "../hooks/useTransactions";
import { useTags } from "../hooks/useTags";
import { useLabels } from "../hooks/useLabels";
import type { LabelSummary } from "../types";

export default function LabelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const labelId = Number(id);
  const navigate = useNavigate();

  const [summary, setSummary] = useState<LabelSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const { tags } = useTags();
  const { labels, refetch: refetchLabels } = useLabels();

  const { transactions, total, refetch: refetchTransactions } = useTransactions({
    label_id: labelId,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    per_page: 50,
  });

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/labels/${labelId}/summary`);
      setSummary(res.data);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to load label",
        color: "red",
      });
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelId]);

  const refreshAll = () => {
    fetchSummary();
    refetchLabels();
    refetchTransactions();
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !summary || trimmed === summary.label.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/labels/${labelId}`, { name: trimmed });
      setEditing(false);
      refreshAll();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to rename label",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!summary) return;
    if (!window.confirm(
      `Delete label "${summary.label.name}"? Transactions are unaffected; only the label and its assignments are removed.`
    )) return;
    setBusy(true);
    try {
      await api.delete(`/labels/${labelId}`);
      navigate("/labels");
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to delete label",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!summary) {
    return (
      <Stack>
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate("/labels")}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>Loading...</Title>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate("/labels")}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          {editing ? (
            <Group gap="xs">
              <TextInput
                value={editName}
                onChange={(e) => setEditName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
                size="sm"
              />
              <ActionIcon size="sm" color="green" variant="subtle" onClick={handleRename}>
                <IconCheck size={14} />
              </ActionIcon>
              <ActionIcon size="sm" color="gray" variant="subtle" onClick={() => setEditing(false)}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
          ) : (
            <Group gap="xs">
              <Title order={2}>{summary.label.name}</Title>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => {
                  setEditName(summary.label.name);
                  setEditing(true);
                }}
              >
                <IconEdit size={14} />
              </ActionIcon>
            </Group>
          )}
        </Group>
        <Button
          color="red"
          variant="light"
          leftSection={<IconTrash size={14} />}
          onClick={handleDelete}
          disabled={busy}
        >
          Delete label
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">Total spent</Text>
          <Text fw={700} size="xl">${summary.total.toFixed(2)}</Text>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed">Transactions</Text>
          <Text fw={700} size="xl">{summary.transaction_count}</Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper p="md" withBorder>
          <Title order={5} mb="sm">By tag</Title>
          {summary.by_tag.length === 0 ? (
            <Text size="sm" c="dimmed">No spending recorded.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tag</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.by_tag.map((row) => (
                  <Table.Tr key={row.tag}>
                    <Table.Td>{row.tag}</Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      ${row.total.toFixed(2)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
        <Paper p="md" withBorder>
          <Title order={5} mb="sm">By category</Title>
          {summary.by_category.length === 0 ? (
            <Text size="sm" c="dimmed">No spending recorded.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.by_category.map((row) => (
                  <Table.Tr key={row.tag}>
                    <Table.Td>{row.tag}</Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      ${row.total.toFixed(2)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </SimpleGrid>

      <Paper p="md" withBorder>
        <Title order={5} mb="sm">Transactions</Title>
        <TransactionTable
          transactions={transactions}
          total={total}
          page={page}
          perPage={50}
          tags={tags}
          labels={labels}
          sortBy={sortBy}
          sortDir={sortDir}
          onPageChange={setPage}
          onSort={handleSort}
          onRefresh={refreshAll}
        />
      </Paper>
    </Stack>
  );
}
