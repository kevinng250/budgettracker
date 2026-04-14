import csv
from parsers.base import BaseParser


class CapitalOneVentureXParser(BaseParser):
    bank = "Capital One"
    account = "VentureX"

    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        transactions = []
        for row in reader:
            debit = row.get("Debit", "").strip()
            credit = row.get("Credit", "").strip()
            if not debit and not credit:
                continue
            amount = float(debit) if debit else -float(credit)
            description = row["Description"].strip()
            if not description:
                continue
            transactions.append({
                "date": row["Posted Date"].strip(),  # Already YYYY-MM-DD
                "description": description,
                "amount": amount,
                "bank": self.bank,
                "account": self.account,
                "balance": None,
            })
        return transactions
