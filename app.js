const SUPABASE_URL = "https://tqfocdktvjuwoiyfgesb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm9jZGt0dmp1d29peWZnZXNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg0NTIsImV4cCI6MjEwNTQ4NDQ1Mn0.8TW4fQCQHc4c_xTNBEwOK3lSC9HYCbkTbfXuYQB-S8g";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let session = null;

const views = {
  home: document.getElementById("view-home"),
  board: document.getElementById("view-board"),
  mine: document.getElementById("view-mine"),
  write: document.getElementById("view-write"),
  auth: document.getElementById("view-auth"),
};

function show(name) {
  Object.values(views).forEach((el) => el.classList.add("hidden"));
  (views[name] || views.home).classList.remove("hidden");
  if (name === "board") loadBoard();
  if (name === "mine") loadMine();
}

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const dest = btn.getAttribute("data-nav");
    if ((dest === "mine" || dest === "write") && !session) return show("auth");
    show(dest);
  });
});

function renderAuthSlot() {
  const slot = document.getElementById("authSlot");
  const gated = document.querySelectorAll(".needs-auth");
  if (session) {
    gated.forEach((el) => el.classList.remove("hidden"));
    slot.innerHTML = `<span class="meta">${session.user.email}</span>
      <button class="btn ghost" id="outBtn">Sign out</button>`;
    document.getElementById("outBtn").onclick = () => sb.auth.signOut();
  } else {
    gated.forEach((el) => el.classList.add("hidden"));
    slot.innerHTML = `<button class="btn" id="inBtn">Sign in</button>`;
    document.getElementById("inBtn").onclick = () => show("auth");
  }
}

async function loadHour() {
  const { data } = await sb
    .from("ridge_hours")
    .select("title,kicker,body,featured_note_id,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    document.getElementById("hourKicker").textContent = data.kicker || "This hour";
    document.getElementById("hourTitle").textContent = data.title;
    document.getElementById("hourBody").textContent = data.body;
    if (data.featured_note_id) {
      const { data: note } = await sb
        .from("ridge_notes")
        .select("title,body,created_at,author_id")
        .eq("id", data.featured_note_id)
        .maybeSingle();
      if (note) {
        const card = document.getElementById("featureCard");
        card.classList.remove("hidden");
        document.getElementById("featureMeta").textContent =
          "Featured public note · " + new Date(note.created_at).toLocaleString();
        document.getElementById("featureTitle").textContent = note.title;
        document.getElementById("featureBody").textContent = note.body;
      }
    }
  }
}

function cardHtml(note) {
  const snippet = note.body.length > 220 ? note.body.slice(0, 220) + "…" : note.body;
  const badge = note.is_public ? `<span class="badge">Public</span>` : `<span class="badge">Private</span>`;
  return `<article class="card">
    ${badge}
    <h3>${escapeHtml(note.title)}</h3>
    <p>${escapeHtml(snippet)}</p>
    <p class="meta">${new Date(note.created_at).toLocaleString()}</p>
  </article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function loadBoard() {
  const { data, error } = await sb
    .from("ridge_notes")
    .select("id,title,body,is_public,created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(40);
  const el = document.getElementById("board");
  if (error) { el.textContent = error.message; return; }
  el.innerHTML = (data || []).map(cardHtml).join("") || "<p class='lede'>Nothing public yet. Write something and mark it public.</p>";
}

async function loadMine() {
  if (!session) return show("auth");
  const { data, error } = await sb
    .from("ridge_notes")
    .select("id,title,body,is_public,created_at")
    .eq("author_id", session.user.id)
    .order("created_at", { ascending: false });
  const el = document.getElementById("mine");
  if (error) { el.textContent = error.message; return; }
  el.innerHTML = (data || []).map(cardHtml).join("") || "<p class='lede'>Empty desk. Use Write.</p>";
}

document.getElementById("writeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("writeMsg");
  if (!session) return show("auth");
  const fd = new FormData(e.target);
  const payload = {
    author_id: session.user.id,
    title: String(fd.get("title")).trim(),
    body: String(fd.get("body")).trim(),
    is_public: fd.get("is_public") === "on",
  };
  const { error } = await sb.from("ridge_notes").insert(payload);
  msg.textContent = error ? error.message : "Saved.";
  if (!error) {
    e.target.reset();
    if (payload.is_public) show("board");
    else show("mine");
  }
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email"));
  const password = String(fd.get("password"));
  const { error } = await sb.auth.signInWithPassword({ email, password });
  document.getElementById("authMsg").textContent = error ? error.message : "";
  if (!error) show("home");
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const form = document.getElementById("authForm");
  const fd = new FormData(form);
  const email = String(fd.get("email"));
  const password = String(fd.get("password"));
  const { error } = await sb.auth.signUp({ email, password });
  document.getElementById("authMsg").textContent = error
    ? error.message
    : "Account created. If email confirmation is on, check your inbox; otherwise you can sign in now.";
});

function tickClock() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);
  const ms = next - now;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  document.getElementById("clock").textContent =
    `Next turn in ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

sb.auth.onAuthStateChange((_e, s) => {
  session = s;
  renderAuthSlot();
});

sb.auth.getSession().then(({ data }) => {
  session = data.session;
  renderAuthSlot();
});

loadHour();
tickClock();
setInterval(tickClock, 1000);
setInterval(loadHour, 60_000);
show("home");
