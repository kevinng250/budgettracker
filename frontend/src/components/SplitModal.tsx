import { useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Button,
  NumberInput,
  Select,
  Text,
  ActionIcon,
  Table,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { Transaction, Tag } from "../types";

interface SplitRow {
  amount: number | string;
  tag: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  transaction: Transaction;
  tags: Tag[];
  onSplit: () => void;
}

export default function SplitModal({ opened, onClose, transaction, tags, onSplit }: Props) {
  const [splits, setSplits] = useState<SplitRow[]>(() => [
    { amount: transaction.amount, tag: transaction.tag },
    { amount: 0, tag: "other" },
  ]);

  const tagOptions = tags.map((t) => ({ value: t.name, label: t.name }));

  const updateSplit = (index: number, field: keyof SplitRow, value: any) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSplit = () => {
    setSplits((prev) => [...prev, { amount: 0, tag: "other" }]);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return;
    setSplits((prev) => prev.filter((_, i) => i !== index));
  };

  const splitTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remaining = Math.round((transaction.amount - splitTotal) * 100) / 100;
  const canSubmit = Math.abs(remaining) < 0.01 && splits.every((s) => s.tag && Number(s.amount) !== 0);

  const handleSubmit = async () => {
    try {
      await api.post(`/transactions/${transaction.id}/split`, {
        splits: splits.map((s) => ({ amount: Number(s.amount), tag: s.tag })),
      });
      onSplit();
      onClose();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to split transaction",
        color: "red",
      });
    }
  };

  // Reset splits when modal opens with a new transaction
  const handleOpen = () => {
    setSplits([
      { amount: transaction.amount, tag: transaction.tag },
      { amount: 0, tag: "other" },
    ]);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Split Transaction"
      centered
      size="lg"
      onOpen={handleOpen}
    >
      <Stack>
        <div>
          <Text size="sm" c="dimmed">Description</Text>
          <Text fw={500}>{transaction.description}</Text>
        </div>
        <div>
          <Text size="sm" c="dimmed">Original Amount</Text>
          <Text fw={700} size="lg">${transaction.amount.toFixed(2)}</Text>
        </div>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {splits.map((split, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <NumberInput
                    value={split.amount}
                    onChange={(v) => updateSplit(i, "amount", v)}
                    prefix="$"
                    decimalScale={2}
                    step={0.01}
                    size="sm"
                    w={140}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    value={split.tag}
                    onChange={(v) => updateSplit(i, "tag", v || "other")}
                    data={tagOptions}
                    size="sm"
                    w={160}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    disabled={splits.length <= 2}
                    onClick={() => removeSplit(i)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Group justify="space-between">
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={addSplit}
          >
            Add Split
          </Button>
          <Text
            size="sm"
            fw={500}
            c={Math.abs(remaining) < 0.01 ? "green" : "red"}
          >
            Remaining: ${remaining.toFixed(2)}
          </Text>
        </Group>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Split
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
