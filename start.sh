#!/bin/bash
echo "Starting application..."

# Check if DB exists
if [ ! -f "data/interactions.db" ]; then
    echo "Database file not found at data/interactions.db"
    echo "Contents of data/:"
    ls -l data/
    
    # Generate from XML source of truth
    if [ -f "full database.xml" ]; then
        echo "Found full database.xml, generating database..."
        python scripts/parse_drugbank.py
    else
        echo "full database.xml not found. Cannot generate database."
        exit 1
    fi
else
    echo "Database found."
fi

# Run uvicorn
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
