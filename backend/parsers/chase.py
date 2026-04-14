import csv
from datetime import datetime
from parsers.base import BaseParser


class ChaseParser(BaseParser):
    bank = "Chase"
    account = "Credit Card"

    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        transactions = []
        for row in reader:
            amount_str = row["Amount"].strip()
            if not amount_str:
                continue
            amount = -float(amount_str)  # Chase: negative = purchase, so negate
            description = row["Description"].strip()
            if not description:
                continue
            raw_date = row["Post Date"].strip()
            date = datetime.strptime(raw_date, "%m/%d/%Y").strftime("%Y-%m-%d")
            transactions.append({
                "date": date,
                "description": description,
                "amount": amount,
                "bank": self.bank,
                "account": self.account,
                "balance": None,
            })
        return transactions
