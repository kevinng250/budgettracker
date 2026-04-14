import { useState, useEffect, useCallback } from "react";
import {
  Paper,
  Title,
  Table,
  Text,
  Group,
  Button,
  TextInput,
  NumberInput,
  ActionIcon,
  Modal,
  Stack,
} from "@mantine/core";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "../api/client";
import type { AccountBalance, ManualAccount } from "../types";

export default function AccountBalances() {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formBank, setFormBank] = useState("");
  const [formAccount, setFormAccount] = useState("");
  const [formBalance, setFormBalance] = useState<number | string>(0);

  const fetchBalances = useCallback(async () => {
    const res = await api.get("/account-balances");
    setBalances(res.data);
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const total = balances.reduce((sum, b) => sum + b.balance, 0);

  const openAddModal = () => {
    setEditingId(null);
    setFormBank("");
    setFormAccount("");
    setFormBalance(0);
    setModalOpen(true);
  };

  const openEditModal = (b: AccountBalance) => {
    // Only manual accounts can be edited inline
    // For manual accounts, we need the id — fetch it
    api.get("/manual-accounts").then((res) => {
      const match = (res.data as ManualAccount[]).find(
        (m) => m.bank === b.bank && m.account === b.account
      );
      if (match) {
        setEditingId(match.id);
        setFormBank(match.bank);
        setFormAccount(match.account);
        setFormBalance(match.balance);
        setModalOpen(true);
      }
    });
  };

  const handleSave = async () => {
    const bank = formBank.trim();
    const account = formAccount.trim();
    if (!bank || !account) return;
    try {
      if (editingId) {
        await api.patch(`/manual-accounts/${editingId}`, {
          balance: Number(formBalance),
        });
      } else {
        await api.post("/manual-accounts", {
          bank,
          account,
          balance: Number(formBalance),
        });
      }
      setModalOpen(false);
      fetchBalances();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to save",
        color: "red",
      });
    }
  };

  const handleDelete = async (b: AccountBalance) => {
    const res = await api.get("/manual-accounts");
    const match = (res.data as ManualAccount[]).find(
      (m) => m.bank === b.bank && m.account === b.account
    );
    if (match) {
      await api.delete(`/manual-accounts/${match.id}`);
      fetchBalances();
    }
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Account Balances</Title>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={openAddModal}
        >
          Add Account
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Bank</Table.Th>
            <Table.Th>Account</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>Balance</Table.Th>
            <Table.Th style={{ textAlign: "right" }}>As Of</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {balances.map((b, i) => (
            <Table.Tr key={`${b.bank}-${b.account}-${i}`}>
              <Table.Td>{b.bank}</Table.Td>
              <Table.Td>{b.account}</Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                <Text fw={500}>
                  ${b.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: "right" }}>
                <Text size="sm" c="dimmed">{b.date.slice(0, 10)}</Text>
              </Table.Td>
              <Table.Td>
                {b.source === "manual" && (
                  <Group gap={4}>
                    <ActionIcon size="sm" variant="subtle" onClick={() => openEditModal(b)}>
                      <IconEdit size={14} />
                    </ActionIcon>
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDelete(b)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr>
            <Table.Td colSpan={2}>
              <Text fw={700}>Total</Text>
            </Table.Td>
            <Table.Td style={{ textAlign: "right" }}>
              <Text fw={700}>
                ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </Table.Td>
            <Table.Td colSpan={2} />
          </Table.Tr>
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Account Balance" : "Add Manual Account"}
        centered
      >
        <Stack>
          <TextInput
            label="Bank"
            value={formBank}
            onChange={(e) => setFormBank(e.currentTarget.value)}
            disabled={!!editingId}
          />
          <TextInput
            label="Account"
            value={formAccount}
            onChange={(e) => setFormAccount(e.currentTarget.value)}
            disabled={!!editingId}
          />
          <NumberInput
            label="Balance"
            value={formBalance}
            onChange={(v) => setFormBalance(v)}
            prefix="$"
            decimalScale={2}
            thousandSeparator=","
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? "Update" : "Add"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
