export interface Transaction {
  id: number;
  date: string;
  transaction_date?: string | null;
  description: string;
  amount: number;
  bank: string;
  account: string;
  tag: string;
  balance: number | null;
  parent_id: number | null;
  children?: Transaction[];
  label_ids?: number[];
}

export interface Label {
  id: number;
  name: string;
  transaction_count?: number;
  total_spent?: number;
}

export interface LabelSummary {
  label: Label;
  total: number;
  transaction_count: number;
  by_tag: SpendingByTag[];
  by_category: SpendingByTag[];
}

export interface Tag {
  name: string;
  is_default: number;
  category: string | null;
  is_category: number;
}

export interface Category {
  name: string;
  is_default: number;
  position: number;
  tags?: Tag[];
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

export interface AccountCoverage {
  bank: string;
  account: string;
  latest_date: string;
  earliest_date: string;
  count: number;
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

export interface Profile {
  id: number;
  name: string;
  color: string | null;
  is_default: number;
  created_at?: string;
  counts?: {
    transactions: number;
    manual_accounts: number;
    pending_receipts: number;
    upload_log: number;
  };
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

export interface ReceiptLineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  unit?: string;
  line_total: number;
  is_discount?: boolean;
  suggested_tag?: string;
  tag?: string; // user-resolved transaction tag
  item_tags?: string[]; // user-resolved item tags (separate namespace)
  notes?: string;
}

export interface ItemTag {
  name: string;
  is_default: number;
  usage_count?: number;
  last_unit?: string | null;
}

export interface ReceiptItem {
  id: number;
  transaction_id: number;
  description: string;
  line_total: number;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  transaction_date: string;
  merchant: string;
  image_path: string | null;
  item_tags: string[];
}

export interface ExtractedReceipt {
  merchant?: string;
  purchase_date?: string;
  subtotal?: number;
  tax?: number;
  total: number;
  line_items: ReceiptLineItem[];
}

export interface MatchCandidate {
  id: number;
  date: string;
  description: string;
  amount: number;
  bank: string;
  account: string;
}

export interface MatchSuggestion {
  candidates: MatchCandidate[];
  confidence: "high" | "low";
}

export interface ReceiptUploadResponse {
  pending_id: number;
  queued: true;
  stored_path: string | null;
  warnings_count: number;
}

export interface PendingReceiptSummary {
  id: number;
  image_path: string | null;
  merchant: string | null;
  purchase_date: string | null;
  total: number | null;
  warnings_count: number;
  created_at: string;
}

export interface PendingReceiptDetail {
  id: number;
  extracted: ExtractedReceipt;
  warnings: string[];
  stored_path: string | null;
  match_suggestion: MatchSuggestion | null;
  created_at: string;
}
