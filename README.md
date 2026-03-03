# Drug Interaction Checker

A web application to check for potential interactions between multiple medications. Built with a FastAPI backend and a clean Vanilla JS frontend.

## 🚀 Features
- **Secure Accounts**: Register/login with server-side password hashing and token-based sessions.
- **Usage Plans**: Free users get 10 interaction checks/day, premium users get unlimited checks.
- **Admin Controls**: Admins can view users, review premium requests, and activate/deactivate premium.
- **Autocomplete Search**: Quickly find drugs from a large DrugBank-derived dataset.
- **Multi-Drug Support**: Check interactions across an unlimited number of selected drugs per request.
- **OCR + AI Advice**: Upload a prescription image to detect medicines with OpenAI Vision, then receive concise AI safety guidance.
- **Clear Interaction Details**: Readable descriptions of potential risks and interaction mechanisms.
- **Responsive UI**: A modern, mobile-friendly interface with a glassmorphism aesthetic.

## 🛠️ Tech Stack
- **Backend**: FastAPI (Python 3.9)
- **Database**: SQLite (`interactions.db` for drug data, `app.db` for users/sessions/usage)
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Deployment**: Docker, Docker Compose

## 📊 Data Source
The application uses DrugBank XML data from `full database.xml` in the project root. The ingestion script streams the XML and rebuilds `data/interactions.db`, which is the runtime source of truth.

## 📦 Installation & Setup

### Using Docker (Recommended)
1. Ensure you have Docker and Docker Compose installed.
2. Clone the repository and navigate to the project directory.
3. Create local secrets file:
   ```bash
   cp .env.example .env
   # then edit .env and set OPENAI_API_KEY
   ```
4. Start the application:
   ```bash
   docker-compose up --build -d
   ```
5. Access the UI at `http://localhost:8000`.

### Manual Setup
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure environment variables:
   ```bash
   cp .env.example .env
   # set OPENAI_API_KEY in .env
   set -a && source .env && set +a
   ```
3. Place the DrugBank export file at `full database.xml` in the project root, then initialize the SQLite database:
   ```bash
   python scripts/parse_drugbank.py
   ```
4. Run the server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## 👥 Auth and Membership
- The **first registered user** becomes an admin automatically.
- Free users are rate-limited to **10 `/check` requests per UTC day**.
- The same quota applies to OCR checks (`/check/ocr`), while premium users remain unlimited.
- Premium users have no daily check limit.
- Users can submit premium requests from the UI; admins can approve/reject and toggle premium status.
- Registration requires strong passwords (uppercase, lowercase, number, minimum 8 chars).

## 🔐 Security Notes
- Session tokens are randomly generated, stored server-side as SHA-256 hashes, and delivered via `HttpOnly` cookies.
- Login has brute-force protection with temporary lockout after repeated failures.
- Security headers are enabled (`CSP`, `X-Frame-Options`, `nosniff`, `Permissions-Policy`).
- Sensitive endpoints are marked `Cache-Control: no-store`.
- CORS is restricted by default; customize with:
  - `CORS_ALLOWED_ORIGINS` (comma-separated origins)
  - `SESSION_TTL_SECONDS`
  - `SESSION_COOKIE_NAME`
  - `COOKIE_SECURE`
  - `COOKIE_SAMESITE`
  - `MAX_ACTIVE_SESSIONS`
  - `AUTH_MAX_FAILED_ATTEMPTS`
  - `AUTH_WINDOW_SECONDS`
  - `AUTH_BLOCK_SECONDS`
  - `MAX_INTERACTION_RESULTS`
  - `ENABLE_HSTS=true` (when running behind HTTPS)
  - `OPENAI_API_KEY` (required for OCR + AI advice)
  - `OPENAI_VISION_MODEL` (default: `gpt-4.1-mini`)
  - `OPENAI_ADVICE_MODEL` (default: same as vision model)
  - `OPENAI_TIMEOUT_SECONDS`
  - `MAX_OCR_IMAGE_BYTES` (default: 8MB)
- Keep `.env` out of version control (already ignored) and never commit real API keys.

## ⚖️ Disclaimer
*This tool is for informational purposes only. The data provided may not be exhaustive or up-to-date. Always consult a healthcare professional for medical advice.*

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
