from parsers.capitalone_venturex import CapitalOneVentureXParser
from parsers.capitalone_360 import CapitalOne360Parser
from parsers.chase import ChaseParser
from parsers.discover import DiscoverParser
from parsers.sofi import SoFiSavingsParser

HEADER_SIGNATURES = {
    "capital_one_venturex": {
        "headers": {"Transaction Date", "Posted Date", "Card No.", "Description", "Debit", "Credit"},
        "parser": CapitalOneVentureXParser,
    },
    "capital_one_360": {
        "headers": {"Account Number", "Transaction Description", "Transaction Date", "Transaction Type", "Transaction Amount"},
        "parser": CapitalOne360Parser,
    },
    "chase": {
        "headers": {"Transaction Date", "Post Date", "Description", "Category", "Type", "Amount"},
        "parser": ChaseParser,
    },
    "discover": {
        "headers": {"Trans. Date", "Post Date", "Description", "Amount", "Category"},
        "parser": DiscoverParser,
    },
    "sofi_savings": {
        "headers": {"Date", "Description", "Type", "Amount", "Current balance", "Status"},
        "parser": SoFiSavingsParser,
    },
}


def detect_and_get_parser(csv_headers: list[str]):
    header_set = {h.strip() for h in csv_headers}
    for sig in HEADER_SIGNATURES.values():
        if sig["headers"].issubset(header_set):
            return sig["parser"]()
    raise ValueError(f"Unrecognized CSV format. Headers: {csv_headers}")
