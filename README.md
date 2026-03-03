# Drug Interaction Checker

Drug Interaction Checker is a FastAPI + SQLite web application for medication interaction lookup with account-based access control, daily free-tier limits, premium management, OCR-based drug extraction, and AI-generated safety guidance.

## Features
- Account system with secure registration, login, logout, and server-side session handling
- Role-based access: admin and standard users
- Premium workflow: user requests and admin approval/rejection
- Usage controls: free users are limited to 10 checks/day, premium users are unlimited
- Drug search autocomplete from DrugBank-derived data
- Interaction checking across selected medicines with duplicate-pair normalization
- OCR upload endpoint (`/check/ocr`) for extracting drug names from prescription images
- AI advice output with mandatory healthcare-professional disclaimer

## Tech Stack
- Backend: FastAPI, Pydantic, Uvicorn
- Datastores: SQLite (`data/interactions.db`, `data/app.db`)
- Frontend: Vanilla JavaScript, HTML, CSS
- Deployment: Docker, Docker Compose

## Data Source
The interaction dataset is generated from DrugBank XML (`full database.xml`) using:

```bash
python scripts/parse_drugbank.py
```

This rebuilds `data/interactions.db`, which is the runtime source of truth for drug and interaction data.

## Installation

### Docker (Recommended)
1. Create local environment file:
```bash
cp .env.example .env
```
2. Edit `.env` and set at minimum:
```dotenv
OPENAI_API_KEY=your_real_key
```
3. Start the stack:
```bash
docker-compose up --build -d
```
4. Open:
- `http://localhost:8000`

### Manual
1. Install dependencies:
```bash
pip install -r requirements.txt
```
2. Load environment variables:
```bash
cp .env.example .env
set -a && source .env && set +a
```
3. Build interaction DB if needed:
```bash
python scripts/parse_drugbank.py
```
4. Run API:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment Variables
- `OPENAI_API_KEY` (required for OCR + AI advice)
- `OPENAI_VISION_MODEL` (default: `gpt-4.1-mini`)
- `OPENAI_ADVICE_MODEL` (default: same as vision model)
- `OPENAI_TIMEOUT_SECONDS` (default: `30`)
- `MAX_OCR_IMAGE_BYTES` (default: `8388608`)
- `FREE_DAILY_LIMIT` (default: `10`)
- `CORS_ALLOWED_ORIGINS` (CSV list)
- `ALLOWED_HOSTS` (CSV list)
- `SESSION_TTL_SECONDS`
- `SESSION_COOKIE_NAME`
- `COOKIE_SECURE` (`true` in HTTPS production)
- `COOKIE_SAMESITE`
- `MAX_ACTIVE_SESSIONS`
- `AUTH_MAX_FAILED_ATTEMPTS`
- `AUTH_WINDOW_SECONDS`
- `AUTH_BLOCK_SECONDS`
- `MAX_INTERACTION_RESULTS`
- `ENABLE_HSTS` (`true` in HTTPS production)

## Security Notes
- The OpenAI API key is used only on the backend and is never sent to frontend code.
- Session tokens are random, stored as server-side hashes, and delivered via `HttpOnly` cookies.
- Login attempts are protected by lockout/rate controls.
- Security headers are set (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Sensitive API routes are marked `Cache-Control: no-store`.
- Keep `.env` private and out of git.

## Operational Notes
- The first registered user becomes admin automatically.
- Admin users can activate/deactivate premium status and review premium requests.
- OCR checks consume the same daily quota as manual checks.

## Medical Disclaimer
This application is for informational use only and does not replace clinical judgment. Always consult a licensed healthcare professional for diagnosis and treatment decisions.

## License
MIT. See `LICENSE`.
