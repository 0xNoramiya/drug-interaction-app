# Drug Interaction Checker

A web application to check for potential interactions between multiple medications. Built with a FastAPI backend and a clean Vanilla JS frontend.

## 🚀 Features
- **Autocomplete Search**: Quickly find drugs from a database of over 1,700 medications.
- **Multi-Drug Support**: Check interactions across an unlimited number of drugs simultaneously.
- **Clear Interaction Details**: Readable descriptions of potential risks and interaction mechanisms.
- **Responsive UI**: A modern, mobile-friendly interface with a glassmorphism aesthetic.

## 🛠️ Tech Stack
- **Backend**: FastAPI (Python 3.9)
- **Database**: SQLite (Read-only at runtime)
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Deployment**: Docker, Docker Compose

## 📊 Data Source
The application uses drug interaction data parsed from open-source datasets (DrugBank). The ingestion script normalizes drug names and synonyms to provide a robust search experience.

## 📦 Installation & Setup

### Using Docker (Recommended)
1. Ensure you have Docker and Docker Compose installed.
2. Clone the repository and navigate to the project directory.
3. Start the application:
   ```bash
   docker-compose up --build -d
   ```
4. Access the UI at `http://localhost:8000`.

### Manual Setup
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Initialize the SQLite database:
   ```bash
   python scripts/parse_drugbank.py
   ```
3. Run the server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## ⚖️ Disclaimer
*This tool is for informational purposes only. The data provided may not be exhaustive or up-to-date. Always consult a healthcare professional for medical advice.*

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
