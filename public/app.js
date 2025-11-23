(() => {
  const loginPage = document.getElementById("login-page");
  const dashboardPage = document.getElementById("dashboard-page");
  const tokenInput = document.getElementById("token-input");
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");

  const statsCards = document.getElementById("stats-cards");
  const statsChart = document.getElementById("stats-chart").getContext("2d");

  const keysTable = document.getElementById("keys-table");
  const generateKeysBtn = document.getElementById("generate-keys-btn");
  const newKeyType = document.getElementById("new-key-type");
  const newKeyAmount = document.getElementById("new-key-amount");

  const tokensTable = document.getElementById("tokens-table");

  let userRole = "regular";

  // --- Tabs ---
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
      document.getElementById(btn.dataset.tab + "-tab").classList.remove("hidden");
    });
  });

  // --- Login ---
  loginBtn.onclick = async () => {
    const token = tokenInput.value.trim();
    if (!token) return;
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!data.valid) throw new Error(data.reason || "Invalid token");
      userRole = data.role;
      loginPage.classList.add("hidden");
      dashboardPage.classList.remove("hidden");
      loadStats();
      loadKeys();
      if (userRole === "admin") loadTokens();
    } catch (err) {
      loginError.textContent = err.message;
    }
  };

  // --- Stats ---
  let chart;
  async function loadStats() {
    const res = await fetch("/api/stats?range=24h");
    const data = await res.json();
    statsCards.innerHTML = `
      <div class="card">Total Keys: ${data.generated.total}</div>
      <div class="card">Redeemed: ${data.redeemed.total}</div>
      <div class="card">Users: ${data.users}</div>
    `;
    const labels = data.history.map(h => new Date(h.timestamp).toLocaleTimeString());
    const values = data.history.map(h => h.redeemed.total);
    if (chart) chart.destroy();
    chart = new Chart(statsChart, {
      type: "line",
      data: { labels, datasets: [{ label: "Redeemed Keys", data: values, borderColor: "#ff77ff", fill: true }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  // --- Keys ---
  async function loadKeys() {
    const res = await fetch("/api/keys?type=all");
    const data = await res.json();
    keysTable.innerHTML = "";
    data.keys.forEach(k => {
      const div = document.createElement("div");
      div.innerHTML = `
        <span>${k.key}</span>
        <span>${k.type}</span>
        <span>${k.redeemed ? "✅" : "❌"}</span>
        <button data-key="${k.key}">Delete</button>
      `;
      div.querySelector("button").onclick = async () => {
        await fetch("/api/keys/" + k.key, { method: "DELETE" });
        loadKeys();
      };
      keysTable.appendChild(div);
    });
  }

  generateKeysBtn.onclick = async () => {
    const amount = parseInt(newKeyAmount.value) || 1;
    const type = newKeyType.value;
    await fetch(`/api/generate?amount=${amount}&type=${type}`);
    loadKeys();
  }

  // --- Tokens ---
  async function loadTokens() {
    const res = await fetch("/api/tokens");
    const data = await res.json();
    tokensTable.innerHTML = "";
    data.tokens.forEach(t => {
      const div = document.createElement("div");
      div.textContent = `${t.token} - ${t.role}`;
      tokensTable.appendChild(div);
    });
  }

})();
