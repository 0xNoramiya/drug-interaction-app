import base64
import binascii
import hashlib
import hmac
import os
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import get_app_db_connection, get_interactions_db_connection, init_app_db
from .models import (
    AdminPremiumDecisionRequest,
    AdminSetPremiumRequest,
    AdminUserResponse,
    AuthResponse,
    Drug,
    Interaction,
    InteractionCheckRequest,
    InteractionResponse,
    LoginRequest,
    MeResponse,
    MessageResponse,
    PremiumRequestCreate,
    PremiumRequestResponse,
    QuotaStatus,
    RegisterRequest,
    UserProfile,
)

app = FastAPI(title="Drug Interaction Checker")


def parse_cors_origins() -> List[str]:
    origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
    if origins_raw:
        return [origin.strip() for origin in origins_raw.split(",") if origin.strip()]
    return ["http://localhost:8000", "http://127.0.0.1:8000"]


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

FREE_DAILY_LIMIT = int(os.getenv("FREE_DAILY_LIMIT", "10"))
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(7 * 24 * 60 * 60)))
MAX_ACTIVE_SESSIONS = int(os.getenv("MAX_ACTIVE_SESSIONS", "5"))
MAX_INTERACTION_RESULTS = int(os.getenv("MAX_INTERACTION_RESULTS", "500"))
AUTH_MAX_FAILED_ATTEMPTS = int(os.getenv("AUTH_MAX_FAILED_ATTEMPTS", "8"))
AUTH_WINDOW_SECONDS = int(os.getenv("AUTH_WINDOW_SECONDS", str(15 * 60)))
AUTH_BLOCK_SECONDS = int(os.getenv("AUTH_BLOCK_SECONDS", str(15 * 60)))
ENABLE_HSTS = env_bool("ENABLE_HSTS", False)
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session_token")
COOKIE_SECURE = env_bool("COOKIE_SECURE", False)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").strip().lower()
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    COOKIE_SAMESITE = "lax"

SYNONYMS = {
    "aspirin": "acetylsalicylic acid",
    "paracetamol": "acetaminophen",
    "tylenol": "acetaminophen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "alleve": "naproxen"
}


@app.on_event("startup")
def startup():
    init_app_db()


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    if ENABLE_HSTS:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    if request.url.path.startswith(("/auth/", "/admin/", "/premium/", "/check")):
        response.headers["Cache-Control"] = "no-store"
    return response


def utc_now_ts() -> int:
    return int(time.time())


def utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str, salt_bytes: bytes) -> str:
    derived = hashlib.scrypt(
        password=password.encode("utf-8"),
        salt=salt_bytes,
        n=2**14,
        r=8,
        p=1,
        dklen=64,
    )
    return base64.b64encode(derived).decode("ascii")


def create_password_hash(password: str) -> Dict[str, str]:
    salt_bytes = secrets.token_bytes(16)
    return {
        "salt": base64.b64encode(salt_bytes).decode("ascii"),
        "hash": hash_password(password, salt_bytes),
    }


def run_dummy_password_check(password: str) -> None:
    # Constant-time-ish mitigation for user enumeration timing.
    _ = hash_password(password, b"drug-checker-dummy")


def verify_password(password: str, password_salt: str, expected_hash: str) -> bool:
    try:
        salt_bytes = base64.b64decode(password_salt.encode("ascii"), validate=True)
    except (binascii.Error, ValueError):
        return False

    candidate_hash = hash_password(password, salt_bytes)
    return hmac.compare_digest(candidate_hash, expected_hash)


def cleanup_security_state(cursor: sqlite3.Cursor, now_ts: int) -> None:
    cursor.execute(
        """
        DELETE FROM sessions
        WHERE expires_at <= ?
           OR (revoked_at IS NOT NULL AND revoked_at <= ?)
        """,
        (now_ts, now_ts - (7 * 24 * 60 * 60)),
    )
    cursor.execute(
        """
        DELETE FROM auth_rate_limits
        WHERE updated_at <= ?
        """,
        (now_ts - (30 * 24 * 60 * 60),),
    )


def get_blocked_until(cursor: sqlite3.Cursor, identifier: str, now_ts: int) -> int:
    cursor.execute(
        """
        SELECT blocked_until
        FROM auth_rate_limits
        WHERE identifier = ?
        """,
        (identifier,),
    )
    row = cursor.fetchone()
    if not row:
        return 0
    blocked_until = int(row["blocked_until"])
    if blocked_until > now_ts:
        return blocked_until
    return 0


def clear_failed_logins(cursor: sqlite3.Cursor, identifier: str) -> None:
    cursor.execute("DELETE FROM auth_rate_limits WHERE identifier = ?", (identifier,))


def record_failed_login(cursor: sqlite3.Cursor, identifier: str, now_ts: int) -> None:
    cursor.execute(
        """
        SELECT failed_count, first_failed_at
        FROM auth_rate_limits
        WHERE identifier = ?
        """,
        (identifier,),
    )
    row = cursor.fetchone()
    if not row:
        cursor.execute(
            """
            INSERT INTO auth_rate_limits (
                identifier, failed_count, first_failed_at, blocked_until, updated_at
            )
            VALUES (?, 1, ?, 0, ?)
            """,
            (identifier, now_ts, now_ts),
        )
        return

    failed_count = int(row["failed_count"])
    first_failed_at = int(row["first_failed_at"])
    blocked_until = 0

    if now_ts - first_failed_at > AUTH_WINDOW_SECONDS:
        failed_count = 0
        first_failed_at = now_ts

    failed_count += 1
    if failed_count >= AUTH_MAX_FAILED_ATTEMPTS:
        blocked_until = now_ts + AUTH_BLOCK_SECONDS
        failed_count = 0
        first_failed_at = now_ts

    cursor.execute(
        """
        UPDATE auth_rate_limits
        SET failed_count = ?, first_failed_at = ?, blocked_until = ?, updated_at = ?
        WHERE identifier = ?
        """,
        (failed_count, first_failed_at, blocked_until, now_ts, identifier),
    )


def row_to_user_profile(row: sqlite3.Row) -> UserProfile:
    return UserProfile(
        id=row["id"],
        email=row["email"],
        is_admin=bool(row["is_admin"]),
        is_premium=bool(row["is_premium"]),
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


def get_quota_status(conn: sqlite3.Connection, user_id: int, is_premium: bool) -> QuotaStatus:
    today = utc_today()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT check_count FROM daily_usage WHERE user_id = ? AND usage_date = ?",
        (user_id, today),
    )
    row = cursor.fetchone()
    used_today = int(row["check_count"]) if row else 0

    if is_premium:
        return QuotaStatus(
            is_premium=True,
            daily_limit=None,
            used_today=used_today,
            remaining_today=None,
        )

    remaining = max(FREE_DAILY_LIMIT - used_today, 0)
    return QuotaStatus(
        is_premium=False,
        daily_limit=FREE_DAILY_LIMIT,
        used_today=used_today,
        remaining_today=remaining,
    )


def create_session(cursor: sqlite3.Cursor, user_id: int, now_ts: int) -> str:
    cleanup_security_state(cursor, now_ts)
    cursor.execute(
        """
        SELECT id
        FROM sessions
        WHERE user_id = ?
          AND revoked_at IS NULL
          AND expires_at > ?
        ORDER BY created_at ASC
        """,
        (user_id, now_ts),
    )
    active_session_ids = [row["id"] for row in cursor.fetchall()]
    if len(active_session_ids) >= MAX_ACTIVE_SESSIONS:
        revoke_count = len(active_session_ids) - MAX_ACTIVE_SESSIONS + 1
        ids_to_revoke = active_session_ids[:revoke_count]
        id_placeholders = ",".join(["?"] * len(ids_to_revoke))
        cursor.execute(
            f"UPDATE sessions SET revoked_at = ? WHERE id IN ({id_placeholders})",
            [now_ts] + ids_to_revoke,
        )

    for _ in range(3):
        token = secrets.token_urlsafe(48)
        token_hash = hash_token(token)
        expires_at = now_ts + SESSION_TTL_SECONDS
        try:
            cursor.execute(
                """
                INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, token_hash, now_ts, expires_at),
            )
            return token
        except sqlite3.IntegrityError:
            continue
    raise HTTPException(status_code=500, detail="Failed to create session")


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def get_authenticated_session(request: Request, authorization: str = Header(default=None)):
    token = ""
    if authorization:
        scheme, _, token_from_header = authorization.partition(" ")
        token_from_header = token_from_header.strip()
        if scheme.lower() == "bearer" and token_from_header:
            token = token_from_header
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")
    else:
        token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session token")
    if len(token) < 32 or len(token) > 512:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")

    token_hash = hash_token(token)
    now_ts = utc_now_ts()

    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                s.id AS session_id,
                s.user_id AS session_user_id,
                u.id,
                u.email,
                u.is_admin,
                u.is_premium,
                u.is_active,
                u.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > ?
              AND u.is_active = 1
            """,
            (token_hash, now_ts),
        )
        session = cursor.fetchone()
        if not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
        return {
            "token_hash": token_hash,
            "session_id": session["session_id"],
            "user": {
                "id": session["id"],
                "email": session["email"],
                "is_admin": bool(session["is_admin"]),
                "is_premium": bool(session["is_premium"]),
                "is_active": bool(session["is_active"]),
                "created_at": session["created_at"],
            },
        }
    finally:
        conn.close()


def require_admin(session_data=Depends(get_authenticated_session)):
    if not session_data["user"]["is_admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return session_data


def consume_check_quota(conn: sqlite3.Connection, user_id: int, is_premium: bool) -> QuotaStatus:
    today = utc_today()
    cursor = conn.cursor()

    cursor.execute("BEGIN IMMEDIATE")
    cursor.execute(
        """
        INSERT INTO daily_usage (user_id, usage_date, check_count)
        VALUES (?, ?, 0)
        ON CONFLICT(user_id, usage_date) DO NOTHING
        """,
        (user_id, today),
    )
    cursor.execute(
        "SELECT check_count FROM daily_usage WHERE user_id = ? AND usage_date = ?",
        (user_id, today),
    )
    row = cursor.fetchone()
    used = int(row["check_count"]) if row else 0

    if (not is_premium) and used >= FREE_DAILY_LIMIT:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily free limit reached ({FREE_DAILY_LIMIT} checks/day). Upgrade to premium for unlimited checks.",
        )

    cursor.execute(
        "UPDATE daily_usage SET check_count = check_count + 1 WHERE user_id = ? AND usage_date = ?",
        (user_id, today),
    )
    conn.commit()

    return get_quota_status(conn, user_id, is_premium)


@app.post("/auth/register", response_model=AuthResponse)
def register_user(payload: RegisterRequest, response: Response):
    conn = get_app_db_connection()
    cursor = conn.cursor()
    now_ts = utc_now_ts()

    try:
        cursor.execute("BEGIN IMMEDIATE")
        cleanup_security_state(cursor, now_ts)
        cursor.execute("SELECT COUNT(*) AS total FROM users")
        total_users = cursor.fetchone()["total"]
        is_first_user = total_users == 0

        password_data = create_password_hash(payload.password)
        cursor.execute(
            """
            INSERT INTO users (email, password_hash, password_salt, is_admin, is_premium, is_active, created_at)
            VALUES (?, ?, ?, ?, 0, 1, ?)
            """,
            (
                payload.email,
                password_data["hash"],
                password_data["salt"],
                1 if is_first_user else 0,
                now_ts,
            ),
        )
        user_id = cursor.lastrowid
        token = create_session(cursor, user_id, now_ts)
        set_session_cookie(response, token)
        conn.commit()

        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        quota = get_quota_status(conn, user_id, bool(user_row["is_premium"]))
        return AuthResponse(token=None, user=row_to_user_profile(user_row), quota=quota)
    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Identifier already registered")
    finally:
        conn.close()


@app.post("/auth/login", response_model=AuthResponse)
def login_user(payload: LoginRequest, response: Response):
    conn = get_app_db_connection()
    cursor = conn.cursor()
    now_ts = utc_now_ts()
    identifier = payload.email

    try:
        cursor.execute("BEGIN IMMEDIATE")
        cleanup_security_state(cursor, now_ts)

        blocked_until = get_blocked_until(cursor, identifier, now_ts)
        if blocked_until:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later.",
            )

        cursor.execute("SELECT * FROM users WHERE email = ? AND is_active = 1", (identifier,))
        user_row = cursor.fetchone()
        if not user_row:
            run_dummy_password_check(payload.password)
            record_failed_login(cursor, identifier, now_ts)
            conn.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not verify_password(payload.password, user_row["password_salt"], user_row["password_hash"]):
            record_failed_login(cursor, identifier, now_ts)
            conn.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        clear_failed_logins(cursor, identifier)
        token = create_session(cursor, user_row["id"], now_ts)
        set_session_cookie(response, token)
        conn.commit()
        quota = get_quota_status(conn, user_row["id"], bool(user_row["is_premium"]))
        return AuthResponse(token=None, user=row_to_user_profile(user_row), quota=quota)
    finally:
        conn.close()


@app.post("/auth/logout", response_model=MessageResponse)
def logout_user(response: Response, session_data=Depends(get_authenticated_session)):
    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
            (utc_now_ts(), session_data["token_hash"]),
        )
        clear_session_cookie(response)
        conn.commit()
        return MessageResponse(message="Logged out")
    finally:
        conn.close()


@app.get("/auth/me", response_model=MeResponse)
def get_me(session_data=Depends(get_authenticated_session)):
    conn = get_app_db_connection()
    try:
        user = session_data["user"]
        quota = get_quota_status(conn, user["id"], user["is_premium"])
        return MeResponse(
            user=UserProfile(**user),
            quota=quota,
        )
    finally:
        conn.close()


@app.post("/premium/request", response_model=MessageResponse)
def request_premium(payload: PremiumRequestCreate, session_data=Depends(get_authenticated_session)):
    user = session_data["user"]
    if user["is_premium"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already has premium")

    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id FROM premium_requests
            WHERE user_id = ? AND status = 'pending'
            """,
            (user["id"],),
        )
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A premium request is already pending")

        cursor.execute(
            """
            INSERT INTO premium_requests (user_id, status, note, created_at)
            VALUES (?, 'pending', ?, ?)
            """,
            (user["id"], payload.note, utc_now_ts()),
        )
        conn.commit()
        return MessageResponse(message="Premium request submitted")
    finally:
        conn.close()


@app.get("/admin/users", response_model=List[AdminUserResponse])
def list_users(admin_session=Depends(require_admin)):
    today = utc_today()
    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT
                u.id,
                u.email,
                u.is_admin,
                u.is_premium,
                u.is_active,
                u.created_at,
                COALESCE(du.check_count, 0) AS checks_today
            FROM users u
            LEFT JOIN daily_usage du ON du.user_id = u.id AND du.usage_date = ?
            ORDER BY u.created_at DESC
            """,
            (today,),
        )
        rows = cursor.fetchall()
        return [
            AdminUserResponse(
                id=row["id"],
                email=row["email"],
                is_admin=bool(row["is_admin"]),
                is_premium=bool(row["is_premium"]),
                is_active=bool(row["is_active"]),
                created_at=row["created_at"],
                checks_today=row["checks_today"],
            )
            for row in rows
        ]
    finally:
        conn.close()


@app.post("/admin/users/{user_id}/premium", response_model=MessageResponse)
def set_user_premium(user_id: int, payload: AdminSetPremiumRequest, admin_session=Depends(require_admin)):
    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        cursor.execute("UPDATE users SET is_premium = ? WHERE id = ?", (1 if payload.is_premium else 0, user_id))
        conn.commit()
        return MessageResponse(message="Premium membership updated")
    finally:
        conn.close()


@app.get("/admin/premium-requests", response_model=List[PremiumRequestResponse])
def list_premium_requests(
    req_status: str = Query("pending", alias="status", regex="^(all|pending|approved|rejected)$"),
    admin_session=Depends(require_admin),
):
    conn = get_app_db_connection()
    cursor = conn.cursor()
    try:
        if req_status == "all":
            cursor.execute(
                """
                SELECT
                    pr.id,
                    pr.user_id,
                    u.email AS user_email,
                    pr.status,
                    pr.note,
                    pr.created_at,
                    pr.reviewed_at,
                    pr.reviewed_by,
                    rv.email AS reviewed_by_email
                FROM premium_requests pr
                JOIN users u ON u.id = pr.user_id
                LEFT JOIN users rv ON rv.id = pr.reviewed_by
                ORDER BY pr.created_at DESC
                """
            )
        else:
            cursor.execute(
                """
                SELECT
                    pr.id,
                    pr.user_id,
                    u.email AS user_email,
                    pr.status,
                    pr.note,
                    pr.created_at,
                    pr.reviewed_at,
                    pr.reviewed_by,
                    rv.email AS reviewed_by_email
                FROM premium_requests pr
                JOIN users u ON u.id = pr.user_id
                LEFT JOIN users rv ON rv.id = pr.reviewed_by
                WHERE pr.status = ?
                ORDER BY pr.created_at DESC
                """,
                (req_status,),
            )

        rows = cursor.fetchall()
        return [
            PremiumRequestResponse(
                id=row["id"],
                user_id=row["user_id"],
                user_email=row["user_email"],
                status=row["status"],
                note=row["note"],
                created_at=row["created_at"],
                reviewed_at=row["reviewed_at"],
                reviewed_by=row["reviewed_by"],
                reviewed_by_email=row["reviewed_by_email"],
            )
            for row in rows
        ]
    finally:
        conn.close()


def review_premium_request(
    request_id: int,
    reviewer_id: int,
    decision: str,
    note: str = None,
) -> None:
    conn = get_app_db_connection()
    cursor = conn.cursor()
    now_ts = utc_now_ts()
    try:
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute(
            "SELECT id, user_id, status FROM premium_requests WHERE id = ?",
            (request_id,),
        )
        request_row = cursor.fetchone()
        if not request_row:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Premium request not found")
        if request_row["status"] != "pending":
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Premium request already reviewed")

        cursor.execute(
            """
            UPDATE premium_requests
            SET status = ?, note = COALESCE(?, note), reviewed_at = ?, reviewed_by = ?
            WHERE id = ?
            """,
            (decision, note, now_ts, reviewer_id, request_id),
        )

        if decision == "approved":
            cursor.execute(
                "UPDATE users SET is_premium = 1 WHERE id = ?",
                (request_row["user_id"],),
            )

        conn.commit()
    finally:
        conn.close()


@app.post("/admin/premium-requests/{request_id}/approve", response_model=MessageResponse)
def approve_premium_request(
    request_id: int,
    payload: AdminPremiumDecisionRequest,
    admin_session=Depends(require_admin),
):
    review_premium_request(
        request_id=request_id,
        reviewer_id=admin_session["user"]["id"],
        decision="approved",
        note=payload.note,
    )
    return MessageResponse(message="Premium request approved")


@app.post("/admin/premium-requests/{request_id}/reject", response_model=MessageResponse)
def reject_premium_request(
    request_id: int,
    payload: AdminPremiumDecisionRequest,
    admin_session=Depends(require_admin),
):
    review_premium_request(
        request_id=request_id,
        reviewer_id=admin_session["user"]["id"],
        decision="rejected",
        note=payload.note,
    )
    return MessageResponse(message="Premium request rejected")


@app.get("/drugs", response_model=List[Drug])
def search_drugs(
    q: str = Query(..., min_length=2, max_length=60),
    _session_data=Depends(get_authenticated_session),
):
    conn = get_interactions_db_connection()
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
def check_interactions(request: InteractionCheckRequest, session_data=Depends(get_authenticated_session)):
    user = session_data["user"]
    app_conn = get_app_db_connection()
    try:
        quota = consume_check_quota(app_conn, user["id"], user["is_premium"])
    finally:
        app_conn.close()

    conn = get_interactions_db_connection()
    cursor = conn.cursor()

    cleaned_names = []
    seen_names = set()
    for d in request.drugs:
        d_lower = d.lower().strip()
        if "(" in d_lower and d_lower.endswith(")"):
            d_lower = d_lower.split("(")[0].strip()
        d_lower = SYNONYMS.get(d_lower, d_lower)
        if d_lower not in seen_names:
            seen_names.add(d_lower)
            cleaned_names.append(d_lower)
    
    try:
        placeholders = ','.join(['?'] * len(cleaned_names))
        cursor.execute(f"SELECT id, name FROM drugs WHERE name IN ({placeholders})", cleaned_names)
        drug_rows = cursor.fetchall()
        
        drug_map = {row['id']: row['name'] for row in drug_rows}
        drug_ids = list(drug_map.keys())
        
        if len(drug_ids) < 2:
            return InteractionResponse(interactions=[], quota=quota)

        id_placeholders = ','.join(['?'] * len(drug_ids))
        query = f"""
            SELECT DISTINCT
                CASE
                    WHEN drug_a_id < drug_b_id THEN drug_a_id
                    ELSE drug_b_id
                END AS drug_a_id,
                CASE
                    WHEN drug_a_id < drug_b_id THEN drug_b_id
                    ELSE drug_a_id
                END AS drug_b_id,
                description
            FROM interactions
            WHERE drug_a_id IN ({id_placeholders})
              AND drug_b_id IN ({id_placeholders})
              AND drug_a_id != drug_b_id
            ORDER BY drug_a_id, drug_b_id
            LIMIT ?
        """
        
        cursor.execute(query, drug_ids + drug_ids + [MAX_INTERACTION_RESULTS])
        interaction_rows = cursor.fetchall()
        
        interactions = [
            Interaction(
                drug_a=drug_map[row['drug_a_id']].title(),
                drug_b=drug_map[row['drug_b_id']].title(),
                description=row['description']
            )
            for row in interaction_rows
        ]

        return InteractionResponse(interactions=interactions, quota=quota)
    finally:
        conn.close()

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
else:
    print(f"ERROR: {frontend_path} not found!")
