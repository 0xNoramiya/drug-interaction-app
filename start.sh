#!/bin/bash
echo "Starting application..."

# Check if DB exists
if [ ! -f "data/interactions.db" ]; then
    echo "Database file not found at data/interactions.db"
    echo "Contents of data/:"
    ls -l data/
    
    # Try to generate it if CSV exists
    if [ -f "db_drug_interactions.csv" ]; then
        echo "Found CSV, generating database..."
        python scripts/parse_drugbank.py
    else
        echo "CSV also not found. Cannot generate database."
    fi
else
    echo "Database found."
fi

# Run uvicorn
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
