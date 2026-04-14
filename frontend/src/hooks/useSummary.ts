import { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import type { SpendingByTag, SpendingOverTime, BalancePoint, IncomeVsSpending } from "../types";

export function useSpendingByTag(dateFrom?: string, dateTo?: string, mode = "gross") {
  const [data, setData] = useState<SpendingByTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { mode };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const res = await api.get("/summary/by-tag", { params });
    setData(res.data);
    setLoading(false);
  }, [dateFrom, dateTo, mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useSpendingOverTime(
  dateFrom?: string,
  dateTo?: string,
  granularity = "month",
  mode = "gross"
) {
  const [data, setData] = useState<SpendingOverTime[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { granularity, mode };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const res = await api.get("/summary/over-time", { params });
    setData(res.data);
    setLoading(false);
  }, [dateFrom, dateTo, granularity, mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useIncomeVsSpending(dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<IncomeVsSpending[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const res = await api.get("/summary/income-vs-spending", { params });
    setData(res.data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}

export function useBalanceHistory(bank?: string, account?: string) {
  const [data, setData] = useState<BalancePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (bank) params.bank = bank;
    if (account) params.account = account;
    const res = await api.get("/balance-history", { params });
    setData(res.data);
    setLoading(false);
  }, [bank, account]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch };
}
