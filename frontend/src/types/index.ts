export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  bank: string;
  account: string;
  tag: string;
  balance: number | null;
}

export interface Tag {
  name: string;
  is_default: number;
}

export interface UploadResult {
  inserted: number;
  skipped: number;
  transactions: Transaction[];
}

export interface SpendingByTag {
  tag: string;
  total: number;
  count: number;
}

export interface SpendingOverTime {
  period: string;
  total: number;
  count: number;
}

export interface IncomeVsSpending {
  period: string;
  spending: number;
  income: number;
  difference: number;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  per_page: number;
}

export interface BankAccount {
  bank: string;
  account: string;
}

export interface BalancePoint {
  date: string;
  balance: number;
  bank?: string;
  account?: string;
}

export interface AccountBalance {
  bank: string;
  account: string;
  balance: number;
  date: string;
  source: "transaction" | "manual";
}

export interface ManualAccount {
  id: number;
  bank: string;
  account: string;
  balance: number;
  updated_at: string;
}

export interface UploadLogEntry {
  id: number;
  filename: string;
  bank: string;
  account: string;
  date_min: string;
  date_max: string;
  inserted: number;
  uploaded_at: string;
}
