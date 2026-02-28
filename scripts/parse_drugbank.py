import os
import sqlite3
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XML_PATH = os.path.join(BASE_DIR, "full database.xml")
DB_PATH = os.path.join(BASE_DIR, "data", "interactions.db")

DB_NS = "http://www.drugbank.ca"
NS = {"db": DB_NS}
DRUG_TAG = f"{{{DB_NS}}}drug"

BATCH_SIZE_DRUGS = 2000
BATCH_SIZE_INTERACTIONS = 10000


def normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def normalize_text(text: str) -> str:
    return " ".join(text.strip().split())


def get_primary_drugbank_id(drug_elem: ET.Element) -> str:
    dbid = drug_elem.findtext("db:drugbank-id[@primary='true']", default="", namespaces=NS).strip()
    if dbid:
        return dbid
    fallback = drug_elem.findtext("db:drugbank-id", default="", namespaces=NS).strip()
    return fallback


def iter_top_level_drugs(xml_path: str):
    context = ET.iterparse(xml_path, events=("start", "end"))
    _, root = next(context)  # Root <drugbank> start event
    depth = 1

    for event, elem in context:
        if event == "start":
            depth += 1
            continue

        if elem.tag == DRUG_TAG and depth == 2:
            yield elem
            root.clear()

        depth -= 1


def init_db() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA journal_mode = OFF")
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA temp_store = MEMORY")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drugbank_id TEXT UNIQUE NOT NULL,
            name TEXT UNIQUE NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_a_id INTEGER NOT NULL,
            drug_b_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            FOREIGN KEY (drug_a_id) REFERENCES drugs (id),
            FOREIGN KEY (drug_b_id) REFERENCES drugs (id)
        )
        """
    )

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_drug_name ON drugs(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_drugbank_id ON drugs(drugbank_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_interaction_pair ON interactions(drug_a_id, drug_b_id)")
    conn.commit()
    return conn


def ingest_drugs(conn: sqlite3.Connection, xml_path: str) -> int:
    cursor = conn.cursor()
    batch = []
    total_drugs = 0
    skipped = 0

    print(f"Pass 1/2: ingesting drugs from {xml_path}")

    for drug_elem in iter_top_level_drugs(xml_path):
        dbid = get_primary_drugbank_id(drug_elem)
        name = drug_elem.findtext("db:name", default="", namespaces=NS)
        name = normalize_name(name) if name else ""

        if not dbid or not name:
            skipped += 1
            continue

        batch.append((dbid, name))

        if len(batch) >= BATCH_SIZE_DRUGS:
            cursor.executemany(
                "INSERT OR IGNORE INTO drugs (drugbank_id, name) VALUES (?, ?)",
                batch,
            )
            conn.commit()
            total_drugs += len(batch)
            batch.clear()
            print(".", end="", flush=True)

    if batch:
        cursor.executemany(
            "INSERT OR IGNORE INTO drugs (drugbank_id, name) VALUES (?, ?)",
            batch,
        )
        conn.commit()
        total_drugs += len(batch)

    final_count = cursor.execute("SELECT COUNT(*) FROM drugs").fetchone()[0]
    print(f"\nLoaded {final_count:,} drugs (processed rows: {total_drugs:,}, skipped: {skipped:,}).")
    return final_count


def build_drug_id_map(conn: sqlite3.Connection) -> dict:
    cursor = conn.cursor()
    rows = cursor.execute("SELECT id, drugbank_id FROM drugs").fetchall()
    return {row[1]: row[0] for row in rows}


def ingest_interactions(conn: sqlite3.Connection, xml_path: str, drug_id_map: dict) -> int:
    cursor = conn.cursor()
    batch = []
    inserted = 0
    missing_targets = 0

    print(f"Pass 2/2: ingesting interactions from {xml_path}")

    for drug_elem in iter_top_level_drugs(xml_path):
        source_dbid = get_primary_drugbank_id(drug_elem)
        source_id = drug_id_map.get(source_dbid)
        if not source_id:
            continue

        for interaction_elem in drug_elem.findall("db:drug-interactions/db:drug-interaction", NS):
            target_dbid = interaction_elem.findtext("db:drugbank-id", default="", namespaces=NS).strip()
            description = interaction_elem.findtext("db:description", default="", namespaces=NS)
            description = normalize_text(description) if description else ""

            if not target_dbid or not description:
                continue

            target_id = drug_id_map.get(target_dbid)
            if not target_id:
                missing_targets += 1
                continue

            batch.append((source_id, target_id, description))

            if len(batch) >= BATCH_SIZE_INTERACTIONS:
                cursor.executemany(
                    "INSERT INTO interactions (drug_a_id, drug_b_id, description) VALUES (?, ?, ?)",
                    batch,
                )
                conn.commit()
                inserted += len(batch)
                batch.clear()
                print(".", end="", flush=True)

    if batch:
        cursor.executemany(
            "INSERT INTO interactions (drug_a_id, drug_b_id, description) VALUES (?, ?, ?)",
            batch,
        )
        conn.commit()
        inserted += len(batch)

    print(f"\nLoaded {inserted:,} interactions (missing target ids: {missing_targets:,}).")
    return inserted


def main():
    if not os.path.exists(XML_PATH):
        raise FileNotFoundError(
            f"Expected DrugBank XML at '{XML_PATH}'. Place 'full database.xml' in the project root."
        )

    if os.path.exists(DB_PATH):
        print(f"Removing previous database: {DB_PATH}")
        os.remove(DB_PATH)

    conn = init_db()
    try:
        ingest_drugs(conn, XML_PATH)
        drug_id_map = build_drug_id_map(conn)
        ingest_interactions(conn, XML_PATH, drug_id_map)
    finally:
        conn.close()

    print(f"Database rebuild complete: {DB_PATH}")


if __name__ == "__main__":
    main()
