const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8000" : "";
let currentUser = null;
let currentQuota = null;
let selectedDrugs = new Set();

const authScreen = document.getElementById("auth-screen");
const userScreen = document.getElementById("user-screen");
const adminScreen = document.getElementById("admin-screen");
const sessionBar = document.getElementById("session-bar");

const authStatus = document.getElementById("auth-status");
const userStatus = document.getElementById("user-status");
const adminStatus = document.getElementById("admin-status");

const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const registerEmail = document.getElementById("register-email");
const registerPassword = document.getElementById("register-password");

const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");
const requestPremiumBtn = document.getElementById("request-premium-btn");

const sessionEmail = document.getElementById("session-email");
const sessionRole = document.getElementById("session-role");
const userPlan = document.getElementById("user-plan");
const userQuota = document.getElementById("user-quota");

const drugInput = document.getElementById("drug-input");
const addBtn = document.getElementById("add-btn");
const suggestionsList = document.getElementById("suggestions");
const tagsContainer = document.getElementById("drug-tags");
const checkBtn = document.getElementById("check-btn");
const clearBtn = document.getElementById("clear-btn");
const resultsSection = document.getElementById("results-section");
const interactionList = document.getElementById("interaction-list");

const refreshAdminBtn = document.getElementById("refresh-admin-btn");
const adminUsers = document.getElementById("admin-users");
const adminRequests = document.getElementById("admin-requests");

loginBtn.addEventListener("click", login);
registerBtn.addEventListener("click", register);
logoutBtn.addEventListener("click", logout);
requestPremiumBtn.addEventListener("click", requestPremium);

drugInput.addEventListener("input", handleInput);
addBtn.addEventListener("click", addDrugFromInput);
checkBtn.addEventListener("click", checkInteractions);
clearBtn.addEventListener("click", clearAll);

refreshAdminBtn.addEventListener("click", loadAdminData);
adminUsers.addEventListener("click", handleAdminUserAction);
adminRequests.addEventListener("click", handleAdminRequestAction);

boot();

function boot() {
    renderRoute();
    fetchCurrentUser();
}

function setStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("error-text", isError);
}

function clearStatuses() {
    setStatus(authStatus, "");
    setStatus(userStatus, "");
    setStatus(adminStatus, "");
}

function clearSession() {
    currentUser = null;
    currentQuota = null;
    selectedDrugs.clear();
    renderTags();
    interactionList.innerHTML = "";
    resultsSection.classList.add("hidden");
}

function isAuthenticated() {
    return Boolean(currentUser);
}

function isAdmin() {
    return Boolean(currentUser && currentUser.is_admin);
}

function show(el, visible) {
    el.classList.toggle("hidden", !visible);
}

function getQuotaSummary(quota) {
    if (!quota) return "";
    if (quota.is_premium) {
        return `Usage today: ${quota.used_today}. Unlimited checks.`;
    }
    return `Usage today: ${quota.used_today}/${quota.daily_limit}. Remaining: ${quota.remaining_today}.`;
}

function renderRoute() {
    const loggedIn = isAuthenticated();
    const admin = loggedIn && isAdmin();

    show(authScreen, !loggedIn);
    show(sessionBar, loggedIn);
    show(userScreen, loggedIn && !admin);
    show(adminScreen, loggedIn && admin);

    if (!loggedIn) {
        return;
    }

    sessionEmail.textContent = currentUser.email;
    sessionRole.textContent = admin ? "Admin" : "User";

    if (!admin) {
        const premium = currentQuota ? currentQuota.is_premium : currentUser.is_premium;
        userPlan.textContent = premium ? "Premium Account" : "Free Account";
        userQuota.textContent = getQuotaSummary(currentQuota);
        requestPremiumBtn.classList.toggle("hidden", premium);
        checkBtn.disabled = !premium && currentQuota && currentQuota.remaining_today === 0;
    }
}

async function apiRequest(path, options = {}) {
    const method = options.method || "GET";
    const useAuth = options.useAuth !== false;

    const headers = { "Content-Type": "application/json" };

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        credentials: "same-origin",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    let payload = {};
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        payload = await res.json();
    }

    if (!res.ok) {
        if (res.status === 401 && useAuth) {
            clearSession();
            renderRoute();
        }
        let detail = payload.detail || `Request failed (${res.status})`;
        if (Array.isArray(detail)) {
            detail = detail
                .map((item) => item.msg || item.message || "Validation error")
                .join(" | ");
        } else if (typeof detail !== "string") {
            detail = `Request failed (${res.status})`;
        }
        const error = new Error(detail);
        error.status = res.status;
        throw error;
    }

    return payload;
}

async function fetchCurrentUser() {
    try {
        const payload = await apiRequest("/auth/me");
        currentUser = payload.user;
        currentQuota = payload.quota;
        renderRoute();
        clearStatuses();
        if (isAdmin()) {
            loadAdminData();
        }
    } catch (err) {
        clearSession();
        renderRoute();
        if (err.status && err.status === 401) {
            return;
        }
        setStatus(authStatus, err.message, true);
    }
}

async function register() {
    clearStatuses();
    try {
        const payload = await apiRequest("/auth/register", {
            method: "POST",
            useAuth: false,
            body: {
                email: registerEmail.value.trim(),
                password: registerPassword.value
            }
        });
        currentUser = payload.user;
        currentQuota = payload.quota;
        registerPassword.value = "";
        loginPassword.value = "";
        renderRoute();
        if (isAdmin()) {
            loadAdminData();
        }
    } catch (err) {
        setStatus(authStatus, err.message, true);
    }
}

async function login() {
    clearStatuses();
    try {
        const payload = await apiRequest("/auth/login", {
            method: "POST",
            useAuth: false,
            body: {
                email: loginEmail.value.trim(),
                password: loginPassword.value
            }
        });
        currentUser = payload.user;
        currentQuota = payload.quota;
        loginPassword.value = "";
        renderRoute();
        if (isAdmin()) {
            loadAdminData();
        }
    } catch (err) {
        setStatus(authStatus, err.message, true);
    }
}

async function logout() {
    clearStatuses();
    try {
        await apiRequest("/auth/logout", { method: "POST" });
    } catch (_err) {
        // Ignore logout failures and clear local session anyway.
    } finally {
        clearSession();
        renderRoute();
    }
}

async function requestPremium() {
    clearStatuses();
    const note = window.prompt("Optional note for admin:", "") || "";
    try {
        const payload = await apiRequest("/premium/request", {
            method: "POST",
            body: { note: note.trim() || null }
        });
        setStatus(userStatus, payload.message);
    } catch (err) {
        setStatus(userStatus, err.message, true);
    }
}

async function handleInput(e) {
    if (!isAuthenticated() || isAdmin()) {
        suggestionsList.classList.add("hidden");
        return;
    }

    const query = e.target.value.trim();
    if (query.length < 2) {
        suggestionsList.classList.add("hidden");
        return;
    }

    try {
        const drugs = await apiRequest(`/drugs?q=${encodeURIComponent(query)}`);
        showSuggestions(drugs);
    } catch (_err) {
        suggestionsList.classList.add("hidden");
    }
}

function showSuggestions(drugs) {
    suggestionsList.innerHTML = "";
    if (!drugs.length) {
        suggestionsList.classList.add("hidden");
        return;
    }

    drugs.forEach((drug) => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        item.textContent = drug.name;
        item.addEventListener("click", () => {
            addDrug(drug.name);
            drugInput.value = "";
            suggestionsList.classList.add("hidden");
        });
        suggestionsList.appendChild(item);
    });

    suggestionsList.classList.remove("hidden");
}

function addDrugFromInput() {
    const name = drugInput.value.trim();
    if (!name) return;
    addDrug(name);
    drugInput.value = "";
    suggestionsList.classList.add("hidden");
}

function addDrug(name) {
    if (selectedDrugs.has(name)) return;
    selectedDrugs.add(name);
    renderTags();
}

function removeDrug(name) {
    selectedDrugs.delete(name);
    renderTags();
}

function clearAll() {
    selectedDrugs.clear();
    renderTags();
    interactionList.innerHTML = "";
    resultsSection.classList.add("hidden");
}

function renderTags() {
    tagsContainer.innerHTML = "";
    selectedDrugs.forEach((name) => {
        const tag = document.createElement("div");
        tag.className = "drug-tag";

        const label = document.createElement("span");
        label.textContent = name;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-tag";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => removeDrug(name));

        tag.appendChild(label);
        tag.appendChild(removeBtn);
        tagsContainer.appendChild(tag);
    });
}

function renderInteractions(interactions) {
    interactionList.innerHTML = "";
    if (!interactions.length) {
        const empty = document.createElement("p");
        empty.textContent = "No interactions found.";
        interactionList.appendChild(empty);
        return;
    }

    interactions.forEach((item) => {
        const row = document.createElement("div");
        row.className = "interaction-item";

        const pair = document.createElement("div");
        pair.className = "interaction-pair";
        pair.textContent = `${item.drug_a} + ${item.drug_b}`;

        const desc = document.createElement("div");
        desc.textContent = item.description;

        row.appendChild(pair);
        row.appendChild(desc);
        interactionList.appendChild(row);
    });
}

async function checkInteractions() {
    clearStatuses();
    if (!isAuthenticated() || isAdmin()) {
        return;
    }

    if (selectedDrugs.size < 2) {
        setStatus(userStatus, "Add at least 2 drugs.", true);
        return;
    }

    try {
        const payload = await apiRequest("/check", {
            method: "POST",
            body: { drugs: Array.from(selectedDrugs) }
        });
        currentQuota = payload.quota;
        renderRoute();
        renderInteractions(payload.interactions || []);
        show(resultsSection, true);
    } catch (err) {
        setStatus(userStatus, err.message, true);
    }
}

async function loadAdminData() {
    if (!isAuthenticated() || !isAdmin()) return;
    clearStatuses();
    try {
        const users = await apiRequest("/admin/users");
        const requests = await apiRequest("/admin/premium-requests?status=pending");
        renderAdminUsers(users);
        renderAdminRequests(requests);
    } catch (err) {
        setStatus(adminStatus, err.message, true);
    }
}

function renderAdminUsers(users) {
    adminUsers.innerHTML = "";
    if (!users.length) {
        adminUsers.textContent = "No users found.";
        return;
    }

    users.forEach((user) => {
        const row = document.createElement("div");
        row.className = "admin-row";

        const details = document.createElement("div");
        details.className = "admin-row-details";
        details.textContent = `${user.email} | ${user.is_admin ? "Admin" : "User"} | ${user.is_premium ? "Premium" : "Free"} | Checks today: ${user.checks_today}`;

        const actionBtn = document.createElement("button");
        actionBtn.className = "secondary-btn";
        actionBtn.dataset.action = "toggle-premium";
        actionBtn.dataset.userId = String(user.id);
        actionBtn.dataset.setPremium = user.is_premium ? "0" : "1";
        actionBtn.textContent = user.is_premium ? "Deactivate Premium" : "Activate Premium";

        row.appendChild(details);
        row.appendChild(actionBtn);
        adminUsers.appendChild(row);
    });
}

function renderAdminRequests(requests) {
    adminRequests.innerHTML = "";
    if (!requests.length) {
        adminRequests.textContent = "No pending requests.";
        return;
    }

    requests.forEach((request) => {
        const row = document.createElement("div");
        row.className = "admin-row";

        const details = document.createElement("div");
        details.className = "admin-row-details";
        details.textContent = `${request.user_email}${request.note ? ` | Note: ${request.note}` : ""}`;

        const actions = document.createElement("div");
        actions.className = "admin-inline-actions";

        const approveBtn = document.createElement("button");
        approveBtn.className = "primary-btn";
        approveBtn.dataset.action = "approve-request";
        approveBtn.dataset.requestId = String(request.id);
        approveBtn.textContent = "Approve";

        const rejectBtn = document.createElement("button");
        rejectBtn.className = "ghost-btn";
        rejectBtn.dataset.action = "reject-request";
        rejectBtn.dataset.requestId = String(request.id);
        rejectBtn.textContent = "Reject";

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        row.appendChild(details);
        row.appendChild(actions);
        adminRequests.appendChild(row);
    });
}

async function handleAdminUserAction(event) {
    const btn = event.target;
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.dataset.action !== "toggle-premium") return;

    const userId = Number(btn.dataset.userId);
    const setPremium = btn.dataset.setPremium === "1";
    if (!Number.isInteger(userId)) return;

    try {
        await apiRequest(`/admin/users/${userId}/premium`, {
            method: "POST",
            body: { is_premium: setPremium }
        });
        setStatus(adminStatus, "User updated.");
        loadAdminData();
    } catch (err) {
        setStatus(adminStatus, err.message, true);
    }
}

async function handleAdminRequestAction(event) {
    const btn = event.target;
    if (!(btn instanceof HTMLButtonElement)) return;
    if (!btn.dataset.action) return;

    const requestId = Number(btn.dataset.requestId);
    if (!Number.isInteger(requestId)) return;

    const decision = btn.dataset.action === "approve-request" ? "approve" : "reject";
    try {
        await apiRequest(`/admin/premium-requests/${requestId}/${decision}`, {
            method: "POST",
            body: {}
        });
        setStatus(adminStatus, `Request ${decision}d.`);
        loadAdminData();
    } catch (err) {
        setStatus(adminStatus, err.message, true);
    }
}
