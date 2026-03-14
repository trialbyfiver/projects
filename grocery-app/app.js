import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Auth ──────────────────────────────────────────────────────────────────────
const provider = new GoogleAuthProvider();

const authOverlay = document.getElementById("auth-overlay");
const appEl       = document.getElementById("app");
const signinBtn   = document.getElementById("signin-btn");
const signoutBtn  = document.getElementById("signout-btn");
const userAvatar  = document.getElementById("user-avatar");
const authError   = document.getElementById("auth-error");

signinBtn.addEventListener("click", async () => {
  signinBtn.disabled = true;
  signinBtn.textContent = "Signing in…";
  authError.textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    authError.textContent = "Sign-in failed: " + (err.message || "Please try again.");
    signinBtn.disabled = false;
    signinBtn.innerHTML = googleBtnInner();
  }
});

signoutBtn.addEventListener("click", () => signOut(auth));

let unsubscribeItems = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Signed in
    authOverlay.style.display = "none";
    appEl.hidden = false;
    userAvatar.src = user.photoURL || "";
    userAvatar.alt = user.displayName || "User";
    initApp();
  } else {
    // Signed out
    authOverlay.style.display = "flex";
    appEl.hidden = true;
    signinBtn.disabled = false;
    signinBtn.innerHTML = googleBtnInner();
    if (unsubscribeItems) { unsubscribeItems(); unsubscribeItems = null; }
  }
});

// ── List ID (shared via URL) ──────────────────────────────────────────────────
function getListId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get("list");
  if (!id) {
    id = crypto.randomUUID();
    const url = new URL(window.location);
    url.searchParams.set("list", id);
    window.history.replaceState({}, "", url);
  }
  return id;
}

// ── App init (runs after sign-in) ─────────────────────────────────────────────
function initApp() {
  const LIST_ID  = getListId();
  const itemsRef = collection(db, "lists", LIST_ID, "items");

  // DOM refs
  const form       = document.getElementById("add-form");
  const itemInput  = document.getElementById("input-item");
  const amtInput   = document.getElementById("input-amount");
  const storeInput = document.getElementById("input-store");
  const tbody      = document.getElementById("item-tbody");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const shareBtn   = document.getElementById("share-btn");
  const toast      = document.getElementById("toast");
  const emptyMsg   = document.getElementById("empty-msg");

  let currentFilter = "all";
  let allItems = [];

  // Real-time listener
  const q = query(itemsRef, orderBy("createdAt", "asc"));
  unsubscribeItems = onSnapshot(q, (snapshot) => {
    allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
  });

  // Render
  function renderList() {
    const filtered = allItems.filter(item => {
      if (currentFilter === "bought")    return item.bought;
      if (currentFilter === "notbought") return !item.bought;
      return true;
    });

    tbody.innerHTML = "";
    emptyMsg.style.display = filtered.length === 0 ? "block" : "none";

    filtered.forEach(item => {
      const tr = document.createElement("tr");
      tr.className = item.bought ? "bought" : "";
      tr.innerHTML = `
        <td class="col-item">${escHtml(item.item)}</td>
        <td class="col-amount">${escHtml(item.amount)}</td>
        <td class="col-store">${escHtml(item.store)}</td>
        <td class="col-check">
          <input type="checkbox" ${item.bought ? "checked" : ""}
                 data-id="${item.id}" class="check-bought" aria-label="Mark as bought">
        </td>
        <td class="col-del">
          <button data-id="${item.id}" class="del-btn" aria-label="Delete item">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Add item
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const item   = itemInput.value.trim();
    const amount = amtInput.value.trim();
    const store  = storeInput.value.trim();
    if (!item) return;
    await addDoc(itemsRef, { item, amount, store, bought: false, createdAt: serverTimestamp() });
    form.reset();
    itemInput.focus();
  });

  // Toggle bought / Delete
  tbody.addEventListener("change", async (e) => {
    if (e.target.classList.contains("check-bought")) {
      await updateDoc(doc(db, "lists", LIST_ID, "items", e.target.dataset.id), {
        bought: e.target.checked
      });
    }
  });

  tbody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("del-btn")) {
      await deleteDoc(doc(db, "lists", LIST_ID, "items", e.target.dataset.id));
    }
  });

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderList();
    });
  });

  // Share
  shareBtn.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Grocery List", url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard!");
      }
    } catch {
      showToast("Copy this URL: " + url);
    }
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function googleBtnInner() {
  return `<svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg> Sign in with Google`;
}

function escHtml(str) {
  return (str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ── Service Worker ────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
