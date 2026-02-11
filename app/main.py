import os
import sqlite3
from typing import List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import get_db_connection
from .models import Drug, Interaction, InteractionResponse, InteractionCheckRequest

app = FastAPI(title="Drug Interaction Checker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYNONYMS = {
    "aspirin": "acetylsalicylic acid",
    "paracetamol": "acetaminophen",
    "tylenol": "acetaminophen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "alleve": "naproxen"
}

@app.get("/drugs", response_model=List[Drug])
def search_drugs(q: str = Query(..., min_length=1)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = q.lower().strip()
    db_query = f"{query}%"
    
    try:
        results_map = {}
        
        cursor.execute("SELECT id, name FROM drugs WHERE name LIKE ? LIMIT 10", (db_query,))
        for row in cursor.fetchall():
            results_map[row['id']] = Drug(id=row['id'], name=str(row['name']).title())

        for alias, target in SYNONYMS.items():
            if alias.startswith(query):
                cursor.execute("SELECT id, name FROM drugs WHERE name = ?", (target,))
                row = cursor.fetchone()
                if row:
                    display_name = f"{str(row['name']).title()} ({alias.title()})"
                    if row['id'] not in results_map:
                         results_map[row['id']] = Drug(id=row['id'], name=display_name)

        return list(results_map.values())
    finally:
        conn.close()

@app.post("/check", response_model=InteractionResponse)
def check_interactions(request: InteractionCheckRequest):
    if len(request.drugs) < 2:
        return InteractionResponse(interactions=[])

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cleaned_names = []
    for d in request.drugs:
        d_lower = d.lower().strip()
        if "(" in d_lower and d_lower.endswith(")"):
            d_lower = d_lower.split("(")[0].strip()
        d_lower = SYNONYMS.get(d_lower, d_lower)
        cleaned_names.append(d_lower)
    
    try:
        placeholders = ','.join(['?'] * len(cleaned_names))
        cursor.execute(f"SELECT id, name FROM drugs WHERE name IN ({placeholders})", cleaned_names)
        drug_rows = cursor.fetchall()
        
        drug_map = {row['id']: row['name'] for row in drug_rows}
        drug_ids = list(drug_map.keys())
        
        if len(drug_ids) < 2:
            return InteractionResponse(interactions=[])

        id_placeholders = ','.join(['?'] * len(drug_ids))
        query = f"""
            SELECT drug_a_id, drug_b_id, description 
            FROM interactions 
            WHERE drug_a_id IN ({id_placeholders}) 
            AND drug_b_id IN ({id_placeholders})
        """
        
        cursor.execute(query, drug_ids + drug_ids)
        interaction_rows = cursor.fetchall()
        
        interactions = [
            Interaction(
                drug_a=drug_map[row['drug_a_id']].title(),
                drug_b=drug_map[row['drug_b_id']].title(),
                description=row['description']
            )
            for row in interaction_rows
            if row['drug_a_id'] != row['drug_b_id']
        ]
        
        return InteractionResponse(interactions=interactions)
    finally:
        conn.close()

frontend_path = "/app/frontend"
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")

if not os.path.isdir(frontend_path):
    print(f"ERROR: {frontend_path} not found!")
