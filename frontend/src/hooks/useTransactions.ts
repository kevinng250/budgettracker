import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import type { TransactionsResponse } from "../types";

export interface Filters {
  date_from?: string;
  date_to?: string;
  bank?: string;
  account?: string;
  tag?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  per_page?: number;
}

export function useTransactions(filters: Filters = {}) {
  const [data, setData] = useState<TransactionsResponse>({
    transactions: [],
    total: 0,
    page: 1,
    per_page: 50,
  });
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string | number> = {};
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== "") params[key] = val;
    });
    const res = await api.get("/transactions", { params });
    setData(res.data);
    setLoading(false);
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { ...data, loading, refetch: fetchTransactions };
}
