def normalize_description(description: str) -> str:
    return " ".join(description.strip().upper().split())


def infer_tag(db, description: str) -> str:
    normalized = normalize_description(description)
    row = db.execute(
        "SELECT tag, COUNT(*) as cnt FROM transactions "
        "WHERE UPPER(TRIM(description)) = ? "
        "GROUP BY tag ORDER BY cnt DESC LIMIT 1",
        (normalized,),
    ).fetchone()
    return row["tag"] if row else "other"
