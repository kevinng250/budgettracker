import csv
from datetime import datetime
from parsers.base import BaseParser


class CapitalOne360Parser(BaseParser):
    bank = "Capital One"
    account = "360 Checking"

    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        transactions = []
        self.account = self.determineAccountName(filename)
        for row in reader:
            txn_type = row["Transaction Type"].strip()
            amount_str = row["Transaction Amount"].strip()
            if not amount_str:
                continue
            amount = float(amount_str)
            if txn_type == "Credit":
                amount = -amount  # Negative = money in
            description = row["Transaction Description"].strip()
            if not description:
                continue
            raw_date = row["Transaction Date"].strip()
            date = datetime.strptime(raw_date, "%m/%d/%y").strftime("%Y-%m-%d")
            balance_str = row.get("Balance", "").strip()
            balance = float(balance_str) if balance_str else None
            transactions.append({
                "date": date,
                "description": description,
                "amount": amount,
                "bank": self.bank,
                "account": self.account,
                "balance": balance,
            })
        return transactions

    def determineAccountName(self, filename: str) -> str:
        if "360Checking" in filename:
            return "360 Checking"
        elif "360PerformanceSavings" in filename:
            return "360 Performance Savings"
        else:
            return "Unknown Account"