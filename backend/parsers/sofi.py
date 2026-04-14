import csv
from parsers.base import BaseParser


class SoFiSavingsParser(BaseParser):
    bank = "SoFi"
    account = "Savings"

    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        transactions = []
        self.account = self.determineAccountName(filename)
        for row in reader:
            amount_str = row["Amount"].strip()
            if not amount_str:
                continue
            amount = -float(amount_str)  # SoFi: positive = money in, so negate
            description = row["Description"].strip()
            if not description:
                continue
            date = row["Date"].strip()  # Already YYYY-MM-DD
            balance_str = row.get("Current balance", "").strip()
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
        if "SOFI-Checking" in filename:
            return "Checking"
        elif "SOFI-Savings" in filename:
            return "Savings"
        else:
            return "Unknown Account"
