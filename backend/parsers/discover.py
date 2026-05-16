import csv
from datetime import datetime
from parsers.base import BaseParser


class DiscoverParser(BaseParser):
    bank = "Discover"
    account = "Credit Card"

    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        transactions = []
        for row in reader:
            amount_str = row["Amount"].strip()
            if not amount_str:
                continue
            amount = float(amount_str)  # Discover: positive = purchase
            description = row["Description"].strip()
            if not description:
                continue
            raw_date = row["Post Date"].strip()
            date = datetime.strptime(raw_date, "%m/%d/%Y").strftime("%Y-%m-%d")
            # Discover CSVs sometimes use "Trans. Date", sometimes "Transaction Date".
            txn_raw = (row.get("Trans. Date") or row.get("Transaction Date") or "").strip()
            transaction_date = (
                datetime.strptime(txn_raw, "%m/%d/%Y").strftime("%Y-%m-%d")
                if txn_raw
                else None
            )
            transactions.append({
                "date": date,
                "transaction_date": transaction_date,
                "description": description,
                "amount": amount,
                "bank": self.bank,
                "account": self.account,
                "balance": None,
            })
        return transactions
