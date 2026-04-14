import { Table, Text, Group, Pagination, ActionIcon, Badge } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import TagDropdown from "./TagDropdown";
import type { Transaction, Tag } from "../types";
import api from "../api/client";

interface Props {
  transactions: Transaction[];
  total: number;
  page: number;
  perPage: number;
  tags: Tag[];
  sortBy: string;
  sortDir: string;
  onPageChange: (page: number) => void;
  onSort: (col: string) => void;
  onRefresh: () => void;
}

function formatAmount(amount: number): string {
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

const SORTABLE_COLS = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "bank", label: "Bank" },
  { key: "tag", label: "Tag" },
];

export default function TransactionTable(props: Props) {
  const {
    transactions,
    total,
    page,
    perPage,
    tags,
    sortBy,
    sortDir,
    onPageChange,
    onSort,
    onRefresh,
  } = props;

  const totalPages = Math.ceil(total / perPage);
  const hasBalance = transactions.some((t) => t.balance !== null);

  const handleDelete = async (id: number) => {
    await api.delete(`/transactions/${id}`);
    onRefresh();
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {SORTABLE_COLS.map((col) => (
              <Table.Th
                key={col.key}
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => onSort(col.key)}
              >
                {col.label}
                {sortBy === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </Table.Th>
            ))}
            <Table.Th>Account</Table.Th>
            {hasBalance && <Table.Th>Balance</Table.Th>}
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text ta="center" c="dimmed" py="xl">
                  No transactions found. Upload a CSV to get started.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            transactions.map((txn) => (
              <Table.Tr key={txn.id}>
                <Table.Td>{txn.date}</Table.Td>
                <Table.Td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {txn.description}
                </Table.Td>
                <Table.Td>
                  <Text c={txn.amount < 0 ? "green" : undefined} fw={500}>
                    {formatAmount(txn.amount)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {txn.bank}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <TagDropdown
                    transactionId={txn.id}
                    description={txn.description}
                    currentTag={txn.tag}
                    tags={tags}
                    onUpdated={onRefresh}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {txn.account}
                  </Text>
                </Table.Td>
                {hasBalance && (
                  <Table.Td>
                    {txn.balance !== null ? (
                      <Text size="sm">${txn.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
                    ) : null}
                  </Table.Td>
                )}
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(txn.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={onPageChange} />
        </Group>
      )}
    </>
  );
}
