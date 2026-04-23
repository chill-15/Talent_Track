/* ================================================================
   TalentTrack  –  frontend/js/script.js
   Shared utilities: API calls, auth, toast, theme, form helpers
   ================================================================ */

const API_BASE = "https://talenttrack-wxq1.onrender.com";

// ── Fetch helpers ─────────────────────────────────────────
async function apiPost(url, body) {
  try {
    const r = await fetch(API_BASE + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem("tt_token")
          ? { Authorization: `Bearer ${localStorage.getItem("tt_token")}` }
          : {})
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) throw new Error("Server not responding");

    return await r.json();

  } catch (err) {
    toast("Server is waking up... please wait ⏳", "warning");
    throw err;
  }
}

async function apiGet(url) {
  const r = await fetch(API_BASE + url, {
    headers: localStorage.getItem("tt_token")
      ? { Authorization:`Bearer ${localStorage.getItem("tt_token")}` }
      : {}
  });
  return r.json();
}

async function apiPut(url, body) {
  const r = await fetch(API_BASE + url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("tt_token")}`
    },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(API_BASE + url, {
    method: "DELETE",
    headers: { Authorization:`Bearer ${localStorage.getItem("tt_token")}` }
  });
  return r.json();
}

// ── Auth helpers ──────────────────────────────────────────
function saveAuth(token, user) {
  localStorage.setItem("tt_token", token);
  localStorage.setItem("tt_user",  JSON.stringify(user));
  localStorage.setItem("tt_role",  user.role);
}

function clearAuth() {
  ["tt_token","tt_user","tt_role"].forEach(k => localStorage.removeItem(k));
}

function doLogout() {
  clearAuth();
  window.location.href = "index.html";
}

function doAdminLogout() {
  clearAuth();
  window.location.href = "index.html";
}

// ── Theme ─────────────────────────────────────────────────
function applyTheme() {
  const t = localStorage.getItem("tt_theme") || "light";
  document.documentElement.setAttribute("data-theme", t);
  const btn = document.querySelector(".theme-btn");
  if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("tt_theme", next);
  document.querySelectorAll(".theme-btn").forEach(b => { b.textContent = next === "dark" ? "☀️" : "🌙"; });
}

// ── Toast notifications ───────────────────────────────────
function toast(msg, type = "info") {
  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||"ℹ️"}</span><span class="toast-msg">${msg}</span>`;
  let box = document.getElementById("toast-container");
  if (!box) { box = document.createElement("div"); box.id="toast-container"; document.body.appendChild(box); }
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; }, 3200);
  setTimeout(() => el.remove(), 3700);
}

// ── Form helpers ──────────────────────────────────────────
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent  = msg;
  el.style.display = "block";
}

function clearErrors() {
  document.querySelectorAll(".form-error").forEach(el => {
    el.textContent   = "";
    el.style.display = "none";
  });
}

function setLoading(btnId, txtId, spId, loading, defaultTxt) {
  const btn = document.getElementById(btnId);
  const txt = document.getElementById(txtId);
  const sp  = document.getElementById(spId);
  if (!btn) return;
  btn.disabled = loading;
  if (txt) txt.style.display  = loading ? "none" : "inline";
  if (sp)  sp.style.display   = loading ? "inline-block" : "none";
  if (!loading && defaultTxt && txt) txt.textContent = defaultTxt;
}

// ── Modal helper ──────────────────────────────────────────
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

// Apply theme immediately on every page
applyTheme();
