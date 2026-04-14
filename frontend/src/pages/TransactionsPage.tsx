import { useState, useEffect } from "react";
import { Title, Paper, Text } from "@mantine/core";
import FileUpload from "../components/FileUpload";
import FilterBar from "../components/FilterBar";
import TransactionTable from "../components/TransactionTable";
import UploadLog from "../components/UploadLog";
import { useTransactions, type Filters } from "../hooks/useTransactions";
import { useTags } from "../hooks/useTags";
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [uploadRefreshKey, setUploadRefreshKey] = useState(0);

  const { tags, refetch: refetchTags } = useTags();

  const selectedBank = bank.includes("|") ? bank.split("|")[0] : undefined;
  const selectedAccount = bank.includes("|") ? bank.split("|")[1] : undefined;

  const filters: Filters = {
    date_from: formatDate(dateFrom),
    date_to: formatDate(dateTo),
    bank: selectedBank,
    account: selectedAccount,
    tag: tag || undefined,
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

  const handleUploaded = () => {
    refetch();
    refetchTags();
    fetchBanks();
    setUploadRefreshKey((k) => k + 1);
  };

  return (
    <>
      <Title order={2} mb="md">
        Transactions
      </Title>
      <FileUpload onUploaded={handleUploaded} />
      <UploadLog bankAccounts={bankAccounts} refreshKey={uploadRefreshKey} />
      <Paper p="md" mt="md" withBorder>
        <FilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          bank={bank}
          tag={tag}
          search={search}
          tags={tags}
          bankAccounts={bankAccounts}
          onDateFromChange={(d) => { setDateFrom(d); setPage(1); }}
          onDateToChange={(d) => { setDateTo(d); setPage(1); }}
          onBankChange={(v) => { setBank(v); setPage(1); }}
          onTagChange={(v) => { setTag(v); setPage(1); }}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
        />
        {loading ? (
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
              sortBy={sortBy}
              sortDir={sortDir}
              onPageChange={setPage}
              onSort={handleSort}
              onRefresh={refetch}
            />
          </>
        )}
      </Paper>
    </>
  );
}
