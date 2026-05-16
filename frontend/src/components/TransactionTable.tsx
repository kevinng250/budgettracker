import { useState } from "react";
import { Table, Text, Group, Pagination, ActionIcon, Badge, Checkbox } from "@mantine/core";
import { IconTrash, IconScissors, IconArrowMerge, IconChevronRight, IconChevronDown } from "@tabler/icons-react";
import TagDropdown from "./TagDropdown";
import SplitModal from "./SplitModal";
import LabelPicker from "./LabelPicker";
import type { Transaction, Tag, Label } from "../types";
import api from "../api/client";

interface Props {
  transactions: Transaction[];
  total: number;
  page: number;
  perPage: number;
  tags: Tag[];
  labels?: Label[];
  sortBy: string;
  sortDir: string;
  onPageChange: (page: number) => void;
  onSort: (col: string) => void;
  onRefresh: () => void;
  selectable?: boolean;
  selected?: Set<number>;
  onSelectionChange?: (next: Set<number>) => void;
}

function formatAmount(amount: number): string {
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}$${Math.abs(amount).toFixed(2)}`;
}

const SORTABLE_COLS = [
  { key: "date", label: "Posted Date" },
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
    labels = [],
    sortBy,
    sortDir,
    onPageChange,
    onSort,
    onRefresh,
    selectable = false,
    selected,
    onSelectionChange,
  } = props;

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [splitTarget, setSplitTarget] = useState<Transaction | null>(null);

  const totalPages = Math.ceil(total / perPage);
  const hasBalance = transactions.some((t) => t.balance !== null);

  const handleDelete = async (id: number) => {
    await api.delete(`/transactions/${id}`);
    onRefresh();
  };

  const handleMerge = async (id: number) => {
    await api.post(`/transactions/${id}/merge`);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onRefresh();
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isSplitParent = (txn: Transaction) => txn.children && txn.children.length > 0;

  const selectableIds = transactions.filter((t) => !isSplitParent(t)).map((t) => t.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected?.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selected?.has(id));

  const toggleRow = (id: number) => {
    if (!onSelectionChange || !selected) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!onSelectionChange || !selected) return;
    const next = new Set(selected);
    if (allSelected) {
      selectableIds.forEach((id) => next.delete(id));
    } else {
      selectableIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  // Columns: posted date, description, amount, bank, tag, trans date, account, [balance], actions
  const colCount = 8 + (hasBalance ? 1 : 0) + (selectable ? 1 : 0);

  const renderChildRow = (child: Transaction) => (
    <Table.Tr key={child.id} style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
      {selectable && <Table.Td />}
      <Table.Td />
      <Table.Td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <Text size="sm" c="dimmed" pl="md">{child.description}</Text>
      </Table.Td>
      <Table.Td>
        <Text c={child.amount < 0 ? "green" : undefined} fw={500} size="sm">
          {formatAmount(child.amount)}
        </Text>
      </Table.Td>
      <Table.Td />
      <Table.Td>
        <TagDropdown
          transactionId={child.id}
          description={child.description}
          currentTag={child.tag}
          tags={tags}
          onUpdated={onRefresh}
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" c={child.transaction_date ? "dimmed" : "dimmed"}>
          {child.transaction_date ?? "—"}
        </Text>
      </Table.Td>
      <Table.Td />
      {hasBalance && <Table.Td />}
      <Table.Td />
    </Table.Tr>
  );

  const renderRow = (txn: Transaction) => {
    const split = isSplitParent(txn);
    const isExpanded = expanded.has(txn.id);

    return [
      <Table.Tr
        key={txn.id}
        style={split ? { backgroundColor: "var(--mantine-color-blue-0)" } : undefined}
      >
        {selectable && (
          <Table.Td>
            {!split && (
              <Checkbox
                size="xs"
                checked={selected?.has(txn.id) ?? false}
                onChange={() => toggleRow(txn.id)}
                aria-label={`Select transaction ${txn.id}`}
              />
            )}
          </Table.Td>
        )}
        <Table.Td>
          <Group gap={4} wrap="nowrap">
            {split && (
              <ActionIcon variant="subtle" size="xs" onClick={() => toggleExpand(txn.id)}>
                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </ActionIcon>
            )}
            <Text size="sm">{txn.date}</Text>
          </Group>
        </Table.Td>
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
          {split ? (
            <Badge variant="outline" size="sm" color="blue">Split</Badge>
          ) : (
            <TagDropdown
              transactionId={txn.id}
              description={txn.description}
              currentTag={txn.tag}
              tags={tags}
              onUpdated={onRefresh}
            />
          )}
        </Table.Td>
        <Table.Td>
          <Text size="sm" c={txn.transaction_date ? undefined : "dimmed"}>
            {txn.transaction_date ?? "—"}
          </Text>
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
          <Group gap={4} wrap="nowrap">
            {!split && (
              <LabelPicker
                transactionId={txn.id}
                currentLabelIds={txn.label_ids ?? []}
                labels={labels}
                onSaved={onRefresh}
              />
            )}
            {split ? (
              <ActionIcon
                variant="subtle"
                color="blue"
                size="sm"
                title="Merge splits"
                onClick={() => handleMerge(txn.id)}
              >
                <IconArrowMerge size={14} />
              </ActionIcon>
            ) : (
              <ActionIcon
                variant="subtle"
                size="sm"
                title="Split transaction"
                onClick={() => setSplitTarget(txn)}
              >
                <IconScissors size={14} />
              </ActionIcon>
            )}
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              title="Delete"
              onClick={() => handleDelete(txn.id)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>,
      ...(split && isExpanded ? txn.children!.map(renderChildRow) : []),
    ];
  };

  return (
    <>
      <Table.ScrollContainer minWidth={880}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {selectable && (
              <Table.Th style={{ width: 40 }}>
                <Checkbox
                  size="xs"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  aria-label="Select all on page"
                />
              </Table.Th>
            )}
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
            <Table.Th>Trans Date</Table.Th>
            <Table.Th>Account</Table.Th>
            {hasBalance && <Table.Th>Balance</Table.Th>}
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={colCount}>
                <Text ta="center" c="dimmed" py="xl">
                  No transactions found. Upload a CSV to get started.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            transactions.flatMap(renderRow)
          )}
        </Table.Tbody>
      </Table>
      </Table.ScrollContainer>
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={onPageChange} />
        </Group>
      )}
      {splitTarget && (
        <SplitModal
          opened={!!splitTarget}
          onClose={() => setSplitTarget(null)}
          transaction={splitTarget}
          tags={tags}
          onSplit={onRefresh}
        />
      )}
    </>
  );
}
