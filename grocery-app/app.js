import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const LIST_ID = getListId();
const itemsRef = collection(db, "lists", LIST_ID, "items");

// ── DOM refs ──────────────────────────────────────────────────────────────────
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

// ── Real-time listener ────────────────────────────────────────────────────────
const q = query(itemsRef, orderBy("createdAt", "asc"));
onSnapshot(q, (snapshot) => {
  allItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderList();
});

// ── Render ────────────────────────────────────────────────────────────────────
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

// ── Add item ──────────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const item  = itemInput.value.trim();
  const amount = amtInput.value.trim();
  const store = storeInput.value.trim();
  if (!item) return;

  await addDoc(itemsRef, {
    item,
    amount,
    store,
    bought: false,
    createdAt: serverTimestamp()
  });

  form.reset();
  itemInput.focus();
});

// ── Toggle bought / Delete (event delegation) ─────────────────────────────────
tbody.addEventListener("change", async (e) => {
  if (e.target.classList.contains("check-bought")) {
    const id = e.target.dataset.id;
    await updateDoc(doc(db, "lists", LIST_ID, "items", id), {
      bought: e.target.checked
    });
  }
});

tbody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("del-btn")) {
    const id = e.target.dataset.id;
    await deleteDoc(doc(db, "lists", LIST_ID, "items", id));
  }
});

// ── Filters ───────────────────────────────────────────────────────────────────
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderList();
  });
});

// ── Share ─────────────────────────────────────────────────────────────────────
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
    showToast("Copy this URL to share: " + url);
  }
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return (str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ── Service Worker ────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
