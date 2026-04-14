from abc import ABC, abstractmethod
import csv


class BaseParser(ABC):
    bank: str
    account: str

    @abstractmethod
    def parse(self, reader: csv.DictReader, filename: str = "") -> list[dict]:
        """Return list of {date, description, amount, bank, account}."""
        ...
