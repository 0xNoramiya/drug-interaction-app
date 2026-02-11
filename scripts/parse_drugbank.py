import csv
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, 'db_drug_interactions.csv')
DB_PATH = os.path.join(BASE_DIR, 'data', 'interactions.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_a_id INTEGER NOT NULL,
            drug_b_id INTEGER NOT NULL,
            description TEXT,
            FOREIGN KEY (drug_a_id) REFERENCES drugs (id),
            FOREIGN KEY (drug_b_id) REFERENCES drugs (id)
        )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_drug_name ON drugs(name)')
    conn.commit()
    return conn

def parse_and_insert(conn):
    cursor = conn.cursor()
    drugs = {}
    
    print(f"Ingesting data from {CSV_PATH}...")
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        
        interactions_batch = []
        
        for row in reader:
            if not row or len(row) < 3:
                continue
                
            drug_a_name = row[0].strip().lower()
            drug_b_name = row[1].strip().lower()
            description = row[2].strip()
            
            for name in [drug_a_name, drug_b_name]:
                if name not in drugs:
                    cursor.execute('INSERT OR IGNORE INTO drugs (name) VALUES (?)', (name,))
                    if cursor.rowcount == 0:
                         cursor.execute('SELECT id FROM drugs WHERE name = ?', (name,))
                         drugs[name] = cursor.fetchone()[0]
                    else:
                        drugs[name] = cursor.lastrowid
            
            interactions_batch.append((drugs[drug_a_name], drugs[drug_b_name], description))
            
            if len(interactions_batch) >= 1000:
                cursor.executemany('INSERT INTO interactions (drug_a_id, drug_b_id, description) VALUES (?, ?, ?)', interactions_batch)
                interactions_batch = []
                print(".", end="", flush=True)
        
        if interactions_batch:
            cursor.executemany('INSERT INTO interactions (drug_a_id, drug_b_id, description) VALUES (?, ?, ?)', interactions_batch)
            
    conn.commit()
    print("\nImport complete.")

if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    conn = init_db()
    parse_and_insert(conn)
    conn.close()
