import { useState, useEffect } from "react";
import { Title, Paper, Text, Group, Button, Menu } from "@mantine/core";
import { IconTags, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import FilterBar from "../components/FilterBar";
import TransactionTable from "../components/TransactionTable";
import { useTransactions, type Filters } from "../hooks/useTransactions";
import { useTags } from "../hooks/useTags";
import { useCategories } from "../hooks/useCategories";
import { useLabels } from "../hooks/useLabels";
import { useActiveProfile } from "../context/ActiveProfile";
import api from "../api/client";
import type { BankAccount } from "../types";

function formatDate(d: Date | string | null): string | undefined {
  if (!d) return undefined;
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [bank, setBank] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { tags } = useTags();
  const { categories } = useCategories();
  const { activeProfileId } = useActiveProfile();
  const { labels, refetch: refetchLabels } = useLabels(activeProfileId);

  const selectedBank = bank.includes("|") ? bank.split("|")[0] : undefined;
  const selectedAccount = bank.includes("|") ? bank.split("|")[1] : undefined;

  const filters: Filters = {
    date_from: formatDate(dateFrom),
    date_to: formatDate(dateTo),
    bank: selectedBank,
    account: selectedAccount,
    tag: tag || undefined,
    category: category || undefined,
    profile_id: activeProfileId ?? undefined,
    search: search || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    per_page: 50,
  };

  const { transactions, total, loading, refetch } = useTransactions(filters);

  const fetchBanks = async () => {
    const res = await api.get("/banks");
    setBankAccounts(res.data);
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleBulkAssign = async (labelId: number) => {
    if (selected.size === 0) return;
    try {
      await api.post("/transactions/labels/bulk-assign", {
        transaction_ids: Array.from(selected),
        label_id: labelId,
      });
      setSelected(new Set());
      refetch();
      refetchLabels();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.error || "Failed to assign label",
        color: "red",
      });
    }
  };

  const labelOptions = labels.map((l) => (
    <Menu.Item key={l.id} onClick={() => handleBulkAssign(l.id)}>
      {l.name}
    </Menu.Item>
  ));

  return (
    <>
      <Title order={2} mb="md">
        Transactions
      </Title>
      <Paper p="md" withBorder>
        <FilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          bank={bank}
          tag={tag}
          category={category}
          search={search}
          tags={tags}
          categories={categories}
          bankAccounts={bankAccounts}
          onDateFromChange={(d) => { setDateFrom(d); setPage(1); }}
          onDateToChange={(d) => { setDateTo(d); setPage(1); }}
          onBankChange={(v) => { setBank(v); setPage(1); }}
          onTagChange={(v) => { setTag(v); setPage(1); }}
          onCategoryChange={(v) => { setCategory(v); setPage(1); }}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
        />
        {selected.size > 0 && (
          <Paper p="xs" mb="xs" withBorder bg="var(--mantine-color-blue-0)">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {selected.size} selected
              </Text>
              <Group gap="xs">
                <Menu shadow="md" position="bottom-end">
                  <Menu.Target>
                    <Button
                      size="xs"
                      leftSection={<IconTags size={14} />}
                      disabled={labels.length === 0}
                    >
                      {labels.length === 0 ? "No labels yet" : "Assign label"}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Apply to {selected.size} transaction{selected.size === 1 ? "" : "s"}</Menu.Label>
                    {labelOptions}
                  </Menu.Dropdown>
                </Menu>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconX size={14} />}
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </Group>
            </Group>
          </Paper>
        )}
        {loading && transactions.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Loading...</Text>
        ) : (
          <>
            <Text size="sm" c="dimmed" mb="xs">
              {total} transaction{total !== 1 ? "s" : ""}
            </Text>
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
              onRefresh={() => { refetch(); refetchLabels(); }}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
            />
          </>
        )}
      </Paper>
    </>
  );
}
