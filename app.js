const $ = (id) => document.getElementById(id);

// ==================================================
// PIGGY BANK — LOCAL PERSONAL TRACKER
// Preserves saved data and keeps OCR imports reviewable
// ==================================================

const accounts = {
  "School Card": 204.7,
  TNG: 124.03,
  Cash: 1075.0,
  "Red Packets": 0.0,
};

let transactions = [];
let nextId = 1;
let bankDeposits = [];
let bankBalance = 0;
let schoolCardLastReset = "";

const STORAGE_KEY = "piggy-bank-bank-rule-b-v1";
const MIGRATION_KEY = "piggy-bank-starting-data-v3";

// ==================================================
// FIXED CATEGORY IMAGES — local files, no AI/API/network calls
// Keep these files in the assets/ folder next to app.js.
const CATEGORY_IMAGES = {
  Food: "assets/category-food.jpg",
  Drink: "assets/category-drink.jpg",
  Addon: "assets/category-addon.jpg",
  Other: "assets/category-other.jpg",
};

function categoryImage(category) {
  return CATEGORY_IMAGES[normalizeCategory(category)] || CATEGORY_IMAGES.Other;
}

function normalizeCategory(category) {
  const value = String(category || "Other").trim().toLowerCase();
  if (value === "food" || value === "🍜") return "Food";
  if (value === "drink" || value === "beverage") return "Drink";
  if (value === "addon" || value === "add-on" || value === "add on") return "Addon";
  if (value === "other") return "Other";
  return category || "Other";
}

function classifyDescription(description) {
  const raw = String(description || "").normalize("NFKC").toLowerCase();
  const compact = raw.replace(/[\s\p{P}\p{S}]+/gu, "");

  // Add-ons take priority, so 加蛋/加菜 do not get classified as ordinary food.
  const addonPattern = /(?:加菜|配料|加料|配菜|加蛋|加肉|加饭|加面|额外配料|extra\s*(?:topping|egg|meat|side)|add\s*on|addon|topping|extra\s*egg|extra\s*meat|side\s*dish|crispy\s*shallot)/i;
  const addonChinese = /(?:加菜|配料|加料|配菜|加蛋|加肉|加饭|加面|额外配料|加青菜|加叉烧|加鸡肉)/;
  if (addonPattern.test(raw) || addonChinese.test(compact)) return "Addon";

  const drinkPattern = /\b(?:drink|beverage|milo|teh|ais|air|water|juice|coffee|tea|milk|latte|cappuccino|mocha|smoothie|lemonade|soda|cola|coke|pepsi|100plus|isotonic|bubble\s*tea|milk\s*tea|soy\s*milk)\b/i;
  const drinkChinese = /(?:奶茶|珍珠奶茶|豆浆|咖啡|果汁|汽水|柠檬茶|美禄|凉茶|饮料|饮品|矿泉水|奶昔|可乐|苏打水|奶咖|冰茶)/;
  if (drinkPattern.test(raw) || drinkChinese.test(compact)) return "Drink";

  const foodPattern = /\b(?:food|canteen|meal|lunch|dinner|breakfast|supper|bread|rice|noodle|snack|cake|apollo|bakery|biscuit|cookie|chocolate|candy|sweet|pastry|donut|doughnut|muffin|cupcake|tart|bun|sandwich|burger|pizza|pasta|spaghetti|mee|mi|bihun|kuey|laksa|nasi|ayam|chicken|fish|ikan|egg|telur|sausage|nugget|fries|potato|chips|kuih|roti|chapati|prata|pau|dimsum|dumpling|sushi|waffle|pancake|ice\s*cream|yogurt|porridge|wonton|panmee|char\s*kway\s*teow)\b/i;
  const foodChinese = /(?:猪肉粉|猪肉面|凉粉|凉皮|椰浆饭|叻沙|沙爹|炒粿条|板面|云吞面|炒面|炒米粉|米粉|河粉|粉丝|粿条|鸡饭|鸡肉饭|鸡肉|烧卖|包子|馒头|面包|饭团|炒饭|米饭|粥|饺子|水饺|云吞|馄饨|汉堡|披萨|炸鸡|薯条|鱼丸|鸡蛋|豆腐|豆花|蛋糕|饼干|巧克力|冰淇淋|雪糕|华夫饼|蛋挞|麻薯|煎饼|咖喱角|咖喱面|咖喱|面条|面|饭|小吃|甜品|煎蕊|罗惹|经济饭|杂饭)/;
  if (foodPattern.test(raw) || foodChinese.test(compact)) return "Food";
  return "Other";
}

function categoryThumbnail(category, description = "") {
  const normalized = normalizeCategory(category);
  return `<img src="${categoryImage(normalized)}" alt="${escapeHTML(normalized)}" loading="lazy" style="width:38px;height:38px;object-fit:cover;border-radius:9px;flex:0 0 38px">`;
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accounts,
        transactions,
        nextId,
        bankDeposits,
        bankBalance,
        schoolCardLastReset,
      }),
    );
  } catch (error) {
    console.warn("Unable to save Piggy Bank data.", error);
  }
}

function loadState() {
  try {
    // Preserve any existing saved data. Only initialize defaults when no
    // Piggy Bank state exists yet; never clear transactions during startup.
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      saveState();
      localStorage.setItem(MIGRATION_KEY, "done");
      return;
    }

    const saved = JSON.parse(raw);

    if (saved?.accounts && Array.isArray(saved.transactions)) {
      Object.assign(accounts, saved.accounts);
      transactions = saved.transactions;
      nextId = Number(saved.nextId) || 1;
      bankDeposits = Array.isArray(saved.bankDeposits)
        ? saved.bankDeposits
        : [];
      bankBalance = Number(saved.bankBalance) || 0;
      schoolCardLastReset = saved.schoolCardLastReset || "";
    }
  } catch (error) {
    console.error("Could not load saved data.", error);
  }
}

// ==================================================
// HELPERS
// ==================================================

function today() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function money(value) {
  return (
    "RM " +
    Number(value || 0).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function signedMoney(value) {
  return (value >= 0 ? "+ " : "− ") + money(Math.abs(value));
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function formatDate(date, time = "") {
  const parsed = new Date(date + "T12:00:00");
  let label;

  if (date === today()) {
    label = "Today";
  } else if (date === yesterday()) {
    label = "Yesterday";
  } else {
    label = parsed.toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return label + (time ? ", " + time : "");
}

function getEverydayBalance() {
  return accounts["School Card"] + accounts.TNG + accounts.Cash;
}

function getOverallBalance() {
  return getEverydayBalance() + accounts["Red Packets"];
}

function getCurrentMonthTransactions() {
  return transactions.filter((t) => t.date.startsWith(today().slice(0, 7)));
}

function calculateTotals(list) {
  let income = 0;
  let spending = 0;

  list.forEach((t) => {
    if (t.type === "income") income += Number(t.amount);
    if (t.type === "expense") spending += Number(t.amount);
  });

  return { income, spending, net: income - spending };
}

function renderBalance(id, amount) {
  const element = $(id);
  if (!element) return;

  const formatted = money(amount);
  const dot = formatted.lastIndexOf(".");

  element.innerHTML =
    escapeHTML(formatted.slice(0, dot)) +
    "<span>" +
    escapeHTML(formatted.slice(dot)) +
    "</span>";
}

// ==================================================
// HOME DASHBOARD
// ==================================================

function renderAll() {
  renderBalance("everyday-balance", getEverydayBalance());
  renderBalance("overall-balance", getOverallBalance());

  const ids = {
    "school-balance": accounts["School Card"],
    "tng-balance": accounts.TNG,
    "cash-balance": accounts.Cash,
    "quick-school": accounts["School Card"],
    "quick-tng": accounts.TNG,
    "quick-cash": accounts.Cash,
    "quick-packets": accounts["Red Packets"],
  };

  Object.entries(ids).forEach(([id, amount]) => {
    const el = $(id);
    if (el) el.textContent = money(amount);
  });

  const monthTag = $("month-tag");
  if (monthTag) {
    monthTag.textContent = new Date()
      .toLocaleDateString("en-MY", {
        month: "short",
        year: "numeric",
      })
      .toUpperCase();
  }

  const totals = calculateTotals(getCurrentMonthTransactions());

  if ($("monthly-income")) {
    $("monthly-income").textContent = money(totals.income);
  }

  if ($("monthly-spending")) {
    $("monthly-spending").textContent = money(totals.spending);
  }

  if ($("net-change")) {
    $("net-change").textContent = signedMoney(totals.net);
    $("net-change").style.color =
      totals.net >= 0 ? "var(--green)" : "var(--red)";
  }

  const badge = document.querySelector(".net-badge");
  if (badge) {
    badge.textContent = totals.net >= 0 ? "Positive" : "Negative";
    badge.style.color = totals.net >= 0 ? "var(--green)" : "var(--red)";
    badge.style.background = totals.net >= 0 ? "#1c3025" : "#342121";
  }

  renderTransactions();
}

function renderTransactions() {
  const list = $("transaction-list");
  if (!list) return;

  const visible = [...transactions]
    .sort((a, b) =>
      (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")),
    )
    .slice(0, 4);

  list.innerHTML = visible
    .map((t) => {
      const income = t.type === "income";
      const transfer = t.type === "transfer";
      const icon = income ? "↙" : t.type === "reset" ? "↻" : transfer ? "⇄" : "";
      const categoryPhoto = (!income && !transfer && t.type !== "reset") ? categoryThumbnail(t.category, t.description) : "";
      const category = transfer ? "Transfer" : t.category;
      const amount = transfer
        ? money(t.amount)
        : t.type === "reset"
          ? "Refill " + money(t.amount)
          : (income ? "+ " : "− ") + money(t.amount);

      return `
      <div class="transaction-row">
        <div class="transaction-icon ${income ? "income-icon" : t.category === "Food" ? "food" : "other"}" style="overflow:hidden">${categoryPhoto || icon}</div>
        <div class="transaction-info">
          <strong>${escapeHTML(t.description)}</strong>
          <span>${escapeHTML(t.account)} · ${escapeHTML(category || "")}</span>
        </div>
        <div class="transaction-date">${escapeHTML(formatDate(t.date, t.time))}</div>
        <div class="transaction-amount ${income ? "income" : ""}">${amount}</div>
      </div>`;
    })
    .join("");

  if ($("empty-note")) {
    $("empty-note").hidden = visible.length !== 0;
  }
}

// ==================================================
// PAGES
// ==================================================

const pageDescriptions = {
  Home: [
    "Your money, <span>in flow.</span>",
    "A clearer picture of your money starts here.",
  ],
  Transactions: [
    "Every move, <span>accounted for.</span>",
    "Search and review your money movements.",
  ],
  Statistics: [
    "See the <span>bigger picture.</span>",
    "Understand your spending patterns.",
  ],
  Accounts: [
    "Every account, <span>in balance.</span>",
    "Manage your tracked money.",
  ],
  "Red Packets": [
    "Keep your gifts, <span>in flow.</span>",
    "Track your separate gift savings.",
  ],
  Bank: [
    "Your savings, <span>set aside.</span>",
    "Track deposits separately from everyday money.",
  ],
  "Daily Report": [
    "One day at a <span>time.</span>",
    "Review daily money movements.",
  ],
  "Monthly Report": [
    "Your month, <span>made clear.</span>",
    "Review your monthly income and spending.",
  ],
  Settings: [
    "Your money, <span>your rules.</span>",
    "Manage your data and backups.",
  ],
};

function accountOptions(selected = "") {
  return Object.keys(accounts)
    .map(
      (name) =>
        `<option ${name === selected ? "selected" : ""}>${escapeHTML(name)}</option>`,
    )
    .join("");
}

function sortedTransactions(list = transactions) {
  return [...list].sort((a, b) =>
    (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")),
  );
}

function transactionRows(list, actions = true) {
  if (!list.length) {
    return `<div class="empty-state">
      <div class="placeholder-icon">✧</div>
      <h3>No records yet</h3>
      <p>Add a transaction to start tracking your money.</p>
    </div>`;
  }

  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Transaction</th><th>Account</th><th>Category</th><th>Date</th><th>Amount</th>${actions ? "<th>Actions</th>" : ""}</tr></thead>
    <tbody>${list
      .map((t) => {
        const income = t.type === "income";
        const sign = income ? "+ " : t.type === "transfer" ? "" : "− ";
        return `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          ${t.type !== "transfer" && t.type !== "reset" ? categoryThumbnail(t.category, t.description) : ""}
          <div><strong>${escapeHTML(t.description)}</strong><small>${escapeHTML(t.type)}</small></div>
        </div></td>
        <td>${escapeHTML(t.account)}${t.type === "transfer" && t.toAccount ? " → " + escapeHTML(t.toAccount) : ""}</td>
        <td>${escapeHTML(t.type === "transfer" ? "Transfer" : (t.category || t.type))}</td>
        <td>${escapeHTML(formatDate(t.date, t.time))}</td>
        <td class="${income ? "income" : t.type === "expense" ? "expense" : ""}">${sign}${money(t.amount)}</td>
        ${actions ? `<td><button class="small-action" data-edit-tx="${escapeHTML(t.id)}">Edit</button> <button class="small-action danger" data-delete-tx="${escapeHTML(t.id)}">Delete</button></td>` : ""}
      </tr>`;
      })
      .join("")}</tbody>
  </table></div>`;
}

function panel(title, subtitle, body) {
  return `<section class="panel functional-panel">
    <div class="panel-heading"><div><h2>${title}</h2><p>${subtitle}</p></div></div>
    ${body}
  </section>`;
}

function renderTransactionsPage() {
  return panel(
    "All transactions",
    "Search and review your records.",
    `
    <div class="import-toolbar"><div><strong>School Card screenshot import</strong><p class="muted-note">Upload a transaction-history screenshot, review the detected rows, then import only the checked entries.</p></div><input id="school-screenshot" type="file" accept="image/png,image/jpeg,image/webp" hidden><button class="secondary-button" id="import-school-screenshot">Import screenshot</button></div><div id="ocr-review"></div>
    <div class="filter-row">
      <input id="tx-search" class="field-input" placeholder="Search description, account, category…">
      <select id="tx-filter-account" class="field-input"><option value="">All accounts</option>${accountOptions()}</select>
      <select id="tx-filter-type" class="field-input">
        <option value="">All types</option><option value="income">Income</option>
        <option value="expense">Expense</option><option value="transfer">Transfer</option>
      </select>
    </div>
    <div id="transactions-table">${transactionRows(sortedTransactions())}</div>`,
  );
}

function renderAccountsPage() {
  const cards = Object.entries(accounts)
    .map(
      ([name, amount]) => `
    <article class="account-card">
      <div class="account-card-top">
        <span class="account-symbol">${name === "School Card" ? "S" : name === "TNG" ? "T" : name === "Cash" ? "C" : "◇"}</span>
        <span class="account-status">${name === "Red Packets" ? "SEPARATE" : "ACTIVE"}</span>
      </div>
      <span class="account-name">${escapeHTML(name)}</span>
      <strong>${money(amount)}</strong>
      <span class="account-type">${name === "Red Packets" ? "Separate gift savings" : "Everyday account"}</span>
      <button class="small-action" data-adjust-account="${escapeHTML(name)}">Adjust balance</button>
    </article>`,
    )
    .join("");

  return panel(
    "Your accounts",
    "Balances are saved locally in this browser.",
    `
    <div class="functional-account-grid">
      ${cards}
      <article class="account-card">
        <div class="account-card-top"><span class="account-symbol">B</span><span class="account-status">SEPARATE</span></div>
        <span class="account-name">Bank</span><strong>${money(bankBalance)}</strong>
        <span class="account-type">Excluded from Main Balance</span>
        <button class="small-action" data-go="Bank">View deposits</button>
      </article>
    </div>
    <p class="muted-note">Everyday balance: <strong>${money(getEverydayBalance())}</strong> · Overall tracked money: <strong>${money(getOverallBalance())}</strong></p>`,
  );
}

function renderStatisticsPage() {
  const totals = calculateTotals(getCurrentMonthTransactions());
  const expenses = getCurrentMonthTransactions().filter(
    (t) => t.type === "expense",
  );
  const categories = {};

  expenses.forEach((t) => {
    categories[t.category || "Other"] =
      (categories[t.category || "Other"] || 0) + Number(t.amount);
  });

  const rows =
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([name, amount]) => `
      <div class="stat-line"><span>${escapeHTML(name)}</span>
      <div class="stat-track"><span style="width:${totals.spending ? (amount / totals.spending) * 100 : 0}%"></span></div>
      <strong>${money(amount)}</strong></div>`,
      )
      .join("") || `<p class="muted-note">No expenses recorded this month.</p>`;

  return `
    <div class="functional-stats-grid">
      ${panel("Monthly income", "Current calendar month", `<div class="stat-big income">${money(totals.income)}</div>`)}
      ${panel("Monthly spending", "Excludes transfers", `<div class="stat-big expense">${money(totals.spending)}</div>`)}
      ${panel("Net change", "Income minus expenses", `<div class="stat-big">${signedMoney(totals.net)}</div>`)}
    </div>
    ${panel("Spending by category", "Based on recorded expenses.", rows)}
    ${panel("Recent activity", "Latest transactions", transactionRows(sortedTransactions().slice(0, 10), false))}`;
}

function renderRedPacketsPage() {
  const years = {};

  transactions
    .filter((t) => t.account === "Red Packets" && t.type === "income")
    .forEach((t) => {
      const year = t.date.slice(0, 4);
      years[year] = (years[year] || 0) + Number(t.amount);
    });

  const rows =
    Object.entries(years)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(
        ([year, amount]) =>
          `<tr><td>${year}</td><td>${money(amount)}</td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="2">No red packet income records yet.</td></tr>`;

  return panel(
    "Red Packet savings",
    "Track gifts separately from everyday spending.",
    `
    <div class="stat-big">${money(accounts["Red Packets"])}</div>
    <p class="muted-note">Depositing gifts into Bank transfers money; it is not spending.</p>
    <div class="form-grid">
      <label>Gift amount (RM)<input id="packet-amount" class="field-input" type="number" min="0.01" step="0.01"></label>
      <label>Description<input id="packet-description" class="field-input" placeholder="e.g. Chinese New Year"></label>
      <label>Date<input id="packet-date" class="field-input" type="date" value="${today()}"></label>
      <button class="primary-button" id="packet-add">Record gift</button>
    </div>
    <h3>Yearly history</h3>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Year</th><th>Recorded gifts</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>Red Packet transactions</h3>${transactionRows(sortedTransactions(transactions.filter((t) => t.account === "Red Packets")), false)}`,
  );
}

function renderDailyReportPage() {
  const dates = [...new Set(transactions.map((t) => t.date))].sort((a, b) =>
    b.localeCompare(a),
  );
  const rows =
    dates
      .map((date) => {
        const list = transactions.filter((t) => t.date === date);
        const totals = calculateTotals(list);
        return `<tr><td>${escapeHTML(formatDate(date))}</td><td>${money(totals.income)}</td><td>${money(totals.spending)}</td><td>${signedMoney(totals.net)}</td><td>${list.length} record(s)</td></tr>`;
      })
      .join("") || `<tr><td colspan="5">No daily records yet.</td></tr>`;

  return panel(
    "Daily report",
    "Transfers are excluded from income and spending.",
    `
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Income</th><th>Spending</th><th>Net</th><th>Activity</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  );
}

function renderMonthlyReportPage() {
  const months = [
    ...new Set(transactions.map((t) => (t.date || "").slice(0, 7))),
  ].sort((a, b) => b.localeCompare(a));

  const rows =
    months
      .map((month) => {
        const list = transactions.filter((t) => t.date.startsWith(month));
        const totals = calculateTotals(list);
        const label = new Date(month + "-15T12:00:00").toLocaleDateString(
          "en-MY",
          { month: "long", year: "numeric" },
        );
        return `<tr><td>${label}</td><td>${money(totals.income)}</td><td>${money(totals.spending)}</td><td>${signedMoney(totals.net)}</td><td>${list.length} record(s)</td></tr>`;
      })
      .join("") || `<tr><td colspan="5">No monthly records yet.</td></tr>`;

  return panel(
    "Monthly report",
    "Review your historical monthly totals.",
    `
    <input id="month-search" class="field-input" placeholder="Search month…">
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Month</th><th>Income</th><th>Spending</th><th>Net</th><th>Records</th></tr></thead><tbody id="monthly-rows">${rows}</tbody></table></div>`,
  );
}

function renderSettingsPage() {
  return panel(
    "Settings & data",
    "This version stores data in this browser.",
    `
    <p class="muted-note">Export a backup regularly. Clearing browser data may remove your saved records.</p>
    <div class="settings-actions">
      <button class="primary-button" id="export-json">Export JSON backup</button>
      <button class="secondary-button" id="export-csv">Export transactions CSV</button>
      <button class="secondary-button" id="reset-demo">Reset app data</button>
    </div>`,
  );
}

// ==================================================
// BANK — SEPARATE FROM EVERYDAY BALANCE
// ==================================================

function renderBankPage() {
  const rows =
    bankDeposits
      .slice()
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map(
        (item) => `<tr>
      <td>${escapeHTML(formatDate(item.date || today()))}</td>
      <td>${escapeHTML(item.source || "Cash")}</td>
      <td>${escapeHTML(item.description || "Bank deposit")}</td>
      <td>${money(item.amount)}</td>
    </tr>`,
      )
      .join("") || `<tr><td colspan="4">No bank deposits yet.</td></tr>`;

  return panel(
    "Bank deposits",
    "Deposits are transfers, not income or spending.",
    `
    <div class="stat-big">${money(bankBalance)}</div>
    <p class="muted-note">Bank is separate and excluded from Everyday Balance and Overall Tracked Money.</p>
    <div class="form-grid">
      <label>Deposit source<select id="bank-source" class="field-input"><option value="Cash">Cash</option><option value="Red Packets">Red Packets</option></select></label>
      <label>Amount (RM)<input id="bank-amount" class="field-input" type="number" min="0.01" step="0.01"></label>
      <label>Description<input id="bank-description" class="field-input" placeholder="e.g. Savings deposit"></label>
      <label>Date<input id="bank-date" class="field-input" type="date" value="${today()}"></label>
      <button class="primary-button" id="bank-add">Record deposit</button>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>From</th><th>Description</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  );
}

function wireBankPage() {
  const button = $("bank-add");
  if (!button) return;

  button.addEventListener("click", () => {
    const source = $("bank-source").value;
    const amount = Number($("bank-amount").value);
    const description = $("bank-description").value.trim() || "Bank deposit";
    const date = $("bank-date").value || today();

    if (!(amount > 0) || !Number.isFinite(amount)) {
      return alert("Enter a valid deposit amount.");
    }

    if (accounts[source] < amount) {
      return alert("The source account does not have enough money.");
    }

    accounts[source] -= amount;
    bankBalance += amount;

    bankDeposits.push({
      id: `bank-${nextId++}`,
      source,
      amount,
      description,
      date,
    });

    saveState();
    renderAll();
    showPage("Bank");
  });
}

// ==================================================
// PAGE EVENTS
// ==================================================

function renderFunctionalPage(page) {
  const root = $("functional-page");
  if (!root) return;

  const renderers = {
    Transactions: renderTransactionsPage,
    Statistics: renderStatisticsPage,
    Accounts: renderAccountsPage,
    "Red Packets": renderRedPacketsPage,
    "Daily Report": renderDailyReportPage,
    "Monthly Report": renderMonthlyReportPage,
    Settings: renderSettingsPage,
  };

  root.innerHTML = renderers[page] ? renderers[page]() : "";
  root.style.display = page === "Home" || page === "Bank" ? "none" : "block";
  wireFunctionalPage(page);
}

function wireFunctionalPage(page) {
  const root = $("functional-page");
  if (!root) return;

  const search = $("tx-search");
  const accountFilter = $("tx-filter-account");
  const typeFilter = $("tx-filter-type");

  const applyFilters = () => {
    const q = (search?.value || "").toLowerCase();
    const account = accountFilter?.value || "";
    const type = typeFilter?.value || "";

    const filtered = sortedTransactions().filter(
      (t) =>
        (!q ||
          [t.description, t.account, t.category, t.type]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (!account || t.account === account) &&
        (!type || t.type === type),
    );

    if ($("transactions-table")) {
      $("transactions-table").innerHTML = transactionRows(filtered);
      wireTransactionActions();
    }
  };

  [search, accountFilter, typeFilter]
    .filter(Boolean)
    .forEach((el) => el.addEventListener("input", applyFilters));

  wireTransactionActions();

  const importButton = $("import-school-screenshot");
  const screenshotInput = $("school-screenshot");
  if (importButton && screenshotInput) {
    importButton.addEventListener("click", () => screenshotInput.click());
    screenshotInput.addEventListener("change", async () => {
      const file = screenshotInput.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        alert("Please upload a PNG, JPG, or WEBP screenshot."); screenshotInput.value = ""; return;
      }
      if (!window.Tesseract) {
        alert("OCR library did not load. Check your internet connection and reload the page."); screenshotInput.value = ""; return;
      }
      importButton.disabled = true;
      importButton.textContent = "Reading screenshot…";
      try {
        const result = await window.Tesseract.recognize(file, "chi_sim+eng", { logger: (m) => { if (m.status === "recognizing text") importButton.textContent = `Reading… ${Math.round((m.progress || 0) * 100)}%`; } });
        renderOcrReview(result.data.text || "");
      } catch (error) {
        console.error(error); alert("Could not read this screenshot. Try a clearer image.");
      } finally {
        importButton.disabled = false; importButton.textContent = "Import screenshot"; screenshotInput.value = "";
      }
    });
  }

  root.querySelectorAll("[data-adjust-account]").forEach((button) => {
    button.addEventListener("click", () =>
      adjustAccount(button.dataset.adjustAccount),
    );
  });

  root.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.go));
  });

  const packetAdd = $("packet-add");
  if (packetAdd) {
    packetAdd.addEventListener("click", () => {
      const amount = Number($("packet-amount").value);
      const description = $("packet-description").value.trim();
      const date = $("packet-date").value;

      if (!(amount > 0) || !description || !date) {
        return alert("Enter a valid amount, description, and date.");
      }

      accounts["Red Packets"] += amount;
      transactions.push({
        id: `tx-${nextId++}`,
        description,
        account: "Red Packets",
        category: "Red Packet",
        type: "income",
        amount,
        date,
        time: "",
      });

      saveState();
      renderAll();
      showPage("Red Packets");
    });
  }

  const monthSearch = $("month-search");
  if (monthSearch) {
    monthSearch.addEventListener("input", () => {
      const q = monthSearch.value.toLowerCase();
      $("monthly-rows")
        ?.querySelectorAll("tr")
        .forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(q)
            ? ""
            : "none";
        });
    });
  }

  if ($("export-json")) {
    $("export-json").addEventListener("click", () => {
      downloadFile(
        "piggy-bank-backup.json",
        JSON.stringify(
          { accounts, transactions, bankDeposits, bankBalance },
          null,
          2,
        ),
        "application/json",
      );
    });
  }

  if ($("export-csv")) {
    $("export-csv").addEventListener("click", () => {
      const lines = [
        ["date", "description", "account", "category", "type", "amount"],
        ...transactions.map((t) => [
          t.date,
          t.description,
          t.account,
          t.category,
          t.type,
          t.amount,
        ]),
      ];

      const csv = lines
        .map((row) =>
          row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\r\n");

      downloadFile(
        "piggy-bank-transactions.csv",
        csv,
        "text/csv;charset=utf-8",
      );
    });
  }

  if ($("reset-demo")) {
    $("reset-demo").addEventListener("click", () => {
      if (
        !confirm(
          "Reset all Piggy Bank data in this browser? Export a backup first.",
        )
      )
        return;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MIGRATION_KEY);
      location.reload();
    });
  }
}

function wireTransactionActions() {
  document.querySelectorAll("[data-edit-tx]").forEach((button) => {
    button.onclick = () => editTransaction(button.dataset.editTx);
  });

  document.querySelectorAll("[data-delete-tx]").forEach((button) => {
    button.onclick = () => deleteTransaction(button.dataset.deleteTx);
  });
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function editTransaction(id) {
  const t = transactions.find((item) => String(item.id) === String(id));
  if (!t) return;

  const description = prompt("Description:", t.description);
  if (description === null) return;

  const amount = Number(prompt("Amount (RM):", t.amount));
  if (!(amount > 0)) return alert("Amount must be greater than zero.");

  const date = prompt("Date (YYYY-MM-DD):", t.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return alert("Use YYYY-MM-DD.");
  }

  const oldAmount = Number(t.amount);
  if (t.type === "transfer" && accounts[t.account] + oldAmount < amount) {
    return alert("The source account does not have enough money for this edited transfer.");
  }

  if (t.type === "income") accounts[t.account] -= oldAmount;
  if (t.type === "expense") accounts[t.account] += oldAmount;
  if (t.type === "transfer") { accounts[t.account] += oldAmount; accounts[t.toAccount] -= oldAmount; }

  t.description = description.trim() || t.description;
  t.amount = amount;
  t.date = date;

  if (t.type === "income") accounts[t.account] += amount;
  if (t.type === "expense") accounts[t.account] -= amount;
  if (t.type === "transfer") { accounts[t.account] -= amount; accounts[t.toAccount] += amount; }

  saveState();
  renderAll();
  showPage("Transactions");
}

function deleteTransaction(id) {
  const index = transactions.findIndex(
    (item) => String(item.id) === String(id),
  );
  if (index < 0) return;

  const t = transactions[index];
  if (!confirm(`Delete "${t.description}"?`)) return;

  if (t.type === "income") accounts[t.account] -= Number(t.amount);
  if (t.type === "expense") accounts[t.account] += Number(t.amount);
  if (t.type === "transfer") { accounts[t.account] += Number(t.amount); accounts[t.toAccount] -= Number(t.amount); }

  transactions.splice(index, 1);
  saveState();
  renderAll();
  showPage("Transactions");
}

function adjustAccount(name) {
  const value = Number(
    prompt(`Set the actual balance for ${name} (RM):`, accounts[name]),
  );

  if (!Number.isFinite(value)) return;

  accounts[name] = value;
  saveState();
  renderAll();
  showPage("Accounts");
}

function showPage(page) {
  const description = pageDescriptions[page];
  if (!description) return;

  const pageElement = document.querySelector(".page");
  if (!pageElement) return;

  $("page-title").textContent = page;
  $("welcome-title").innerHTML = description[0];
  $("welcome-subtitle").textContent = description[1];

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  [".balance-grid", ".content-grid", ".bottom-grid", ".footer"].forEach(
    (selector) => {
      const el = pageElement.querySelector(selector);
      if (el) el.style.display = page === "Home" ? "" : "none";
    },
  );

  let functional = $("functional-page");
  if (!functional) {
    functional = document.createElement("section");
    functional.id = "functional-page";
    functional.className = "functional-page";
    pageElement.appendChild(functional);
  }

  let bankPage = $("bank-page");

  if (page === "Bank") {
    if (!bankPage) {
      bankPage = document.createElement("section");
      bankPage.id = "bank-page";
      bankPage.className = "bank-page";
      pageElement.appendChild(bankPage);
    }

    bankPage.innerHTML = renderBankPage();
    bankPage.style.display = "block";
    functional.style.display = "none";
    wireBankPage();
  } else {
    if (bankPage) bankPage.style.display = "none";
    renderFunctionalPage(page);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==================================================
// TRANSACTION MODAL
// ==================================================

function openModal() {
  $("form-error").textContent = "";
  $("tx-date").value = today();
  $("modal-backdrop").hidden = false;
  $("tx-amount").focus();
}

function closeModal() {
  $("modal-backdrop").hidden = true;
  $("transaction-form").reset();
  $("form-error").textContent = "";
}

// ==================================================
// INITIAL EVENT LISTENERS
// ==================================================

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});

if ($("view-all")) {
  $("view-all").addEventListener("click", () => showPage("Transactions"));
}

if ($("add-transaction"))
  $("add-transaction").addEventListener("click", openModal);
if ($("floating-add")) $("floating-add").addEventListener("click", openModal);
if ($("close-modal")) $("close-modal").addEventListener("click", closeModal);
if ($("cancel-modal")) $("cancel-modal").addEventListener("click", closeModal);

if ($("modal-backdrop")) {
  $("modal-backdrop").addEventListener("click", (event) => {
    if (event.target === $("modal-backdrop")) closeModal();
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    $("modal-backdrop") &&
    !$("modal-backdrop").hidden
  ) {
    closeModal();
  }
});

// ==================================================
// ADD TRANSACTION
// ==================================================

function updateTransferFields() {
  const isTransfer = $("tx-type")?.value === "transfer";
  if ($("transfer-destination-wrap")) $("transfer-destination-wrap").hidden = !isTransfer;
  if ($("tx-category")) $("tx-category").disabled = isTransfer;
}
$("tx-type")?.addEventListener("change", updateTransferFields);
$("tx-account")?.addEventListener("change", () => {
  const destination = $("tx-transfer-to");
  if (destination && destination.value === $("tx-account").value) {
    destination.value = [...destination.options].map(o => o.value || o.text).find(v => v !== $("tx-account").value) || "TNG";
  }
});

if ($("transaction-form")) {
  $("transaction-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const amount = Number($("tx-amount").value);
    const description = $("tx-description").value.trim();
    const account = $("tx-account").value;
    const type = $("tx-type").value;
    const category = $("tx-category").value;
    const date = $("tx-date").value;

    if (!Number.isFinite(amount) || amount <= 0 || !description || !date) {
      $("form-error").textContent =
        "Please enter a valid amount, description, and date.";
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(accounts, account)) {
      $("form-error").textContent = "Please select a valid account.";
      return;
    }

    if (type === "transfer") {
      const toAccount = $("tx-transfer-to")?.value;
      if (!toAccount || !Object.prototype.hasOwnProperty.call(accounts, toAccount) || toAccount === account) {
        $("form-error").textContent = "Choose two different accounts for the transfer.";
        return;
      }
      if (accounts[account] < amount) {
        $("form-error").textContent = "The source account does not have enough money.";
        return;
      }
      accounts[account] -= amount;
      accounts[toAccount] += amount;
      transactions.push({ id: `tx-${nextId++}`, description, account, toAccount, category: "Transfer", type, amount, date, time: "" });
    } else {
      accounts[account] += type === "income" ? amount : -amount;
      transactions.push({ id: `tx-${nextId++}`, description, account, category, type, amount, date, time: "" });
    }

    saveState();
    renderAll();
    closeModal();
    showPage($("page-title").textContent);
  });
}

// ==================================================
// STYLING FOR DYNAMIC PAGES
// ==================================================

const functionalStyles = document.createElement("style");
functionalStyles.textContent = `
.functional-page{margin-top:24px}
.functional-panel{margin-bottom:20px;padding:24px}
.panel-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.panel-heading h2{margin:0 0 6px;font-size:19px}
.panel-heading p,.muted-note{color:var(--muted,#8b95a7);font-size:12px;line-height:1.6}
.filter-row,.form-grid,.settings-actions{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.field-input{background:var(--surface,#17191d);color:var(--text,#f4f4f5);border:1px solid var(--border,#303238);border-radius:9px;padding:12px;min-width:160px;max-width:100%;font:inherit}
.filter-row .field-input{flex:1}
.table-wrap{overflow-x:auto;width:100%}
.data-table{border-collapse:collapse;width:100%;font-size:12px;min-width:650px}
.data-table th,.data-table td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--border,#303238)}
.data-table th{color:var(--muted,#9ca3af);font-weight:600}
.data-table td small{display:block;color:var(--muted,#9ca3af);margin-top:4px}
.income{color:var(--green,#5de0a0)}
.expense,.danger{color:var(--red,#ff7777)}
.small-action,.text-action{background:transparent;border:1px solid var(--border,#303238);color:var(--text,#eee);padding:6px 9px;border-radius:7px;cursor:pointer;font-size:11px}
.text-action{border:0;color:var(--gold,#e7bf68);padding:0}
.functional-account-grid,.functional-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
.functional-account-grid .account-card{padding:18px}
.stat-big{font-size:28px;font-weight:800;margin:12px 0}
.stat-line{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:12px;margin:15px 0;font-size:12px}
.stat-track{height:7px;background:#27292e;border-radius:8px;overflow:hidden}
.stat-track span{display:block;height:100%;background:linear-gradient(90deg,#e7c875,#c39a48);border-radius:8px}
.empty-state{text-align:center;padding:35px;color:var(--muted,#9ca3af)}
.form-grid label{display:flex;flex-direction:column;gap:8px;color:var(--muted,#9ca3af);font-size:12px;flex:1;min-width:170px}
.secondary-button{background:transparent;border:1px solid var(--border,#303238);color:var(--text,#eee);padding:11px 14px;border-radius:9px}
@media(max-width:700px){.functional-panel{padding:15px}.filter-row{flex-direction:column}.field-input{width:100%}.stat-line{grid-template-columns:80px 1fr auto}.data-table{min-width:580px}}
`;
document.head.appendChild(functionalStyles);

// ==================================================
// SCHOOL CARD SCREENSHOT OCR REVIEW
// ==================================================
function renderOcrReview(text) {
  const host = $("ocr-review");
  if (!host) return;

  // Some OCR engines return the whole screen as one long line. Split by each
  // date/time anchor instead of assuming one transaction per text line.
  const datePattern = /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
  const dateMatches = [...text.matchAll(datePattern)];
  const candidates = [];
  const existingKeys = new Set(transactions.map(t => `${t.date}|${Number(t.amount).toFixed(2)}|${(t.description||"").toLowerCase()}`));
  let cursor = 0;

  for (const match of dateMatches) {
    // Transaction description and amount are usually immediately before the
    // timestamp in the School Card screenshot's OCR output.
    const segment = text.slice(cursor, match.index).replace(/[\r\n]+/g, " ").trim();
    cursor = match.index + match[0].length;
    if (!segment) continue;

    let date = match[1].replace(/[/.]/g, "-");
    const parts = date.split("-");
    if (parts[0].length <= 2) {
      let [d, m, y] = parts;
      if (y.length === 2) y = `20${y}`;
      date = `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
    } else {
      date = `${parts[0]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
    }

    // Prefer currency-marked amounts; tolerate common OCR punctuation errors
    // such as "RM 1.5(" and "RM 6.0(". Do not multiply amounts marked x2:
    // the displayed amount is already the total for that transaction.
    const moneyMatches = [...segment.matchAll(/\b(?:RM|MYR)\s*(-?\d{1,5}[.,]\d{1,2})\s*[()＃]?/gi)];
    const fallbackMatches = moneyMatches.length ? moneyMatches : [...segment.matchAll(/\b(-?\d{1,5}[.,]\d{1,2})\s*[()＃]?/g)];
    if (!fallbackMatches.length) continue;
    const amountMatch = fallbackMatches[fallbackMatches.length - 1];
    const amount = Math.abs(Number(amountMatch[1].replace(",", ".")));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) continue;

    let description = segment.slice(0, amountMatch.index).trim();
    description = description.replace(/\b(?:RM|MYR|balance|transaction|purchase|debit|credit)\b/gi, " ")
      .replace(/\s+/g, " ").replace(/[|,:;\-]+$/g, "").trim();
    // This OCR engine has previously read the School Card add-on "加菜 x2"
    // as variants such as "ngE 2". Correct only this known short OCR pattern.
    if (/^ng[e3]\s*[x×]?\s*2$/i.test(description)) description = "加菜 x2";
    if (!description) description = "School Card transaction — review description";

    const key = `${date}|${amount.toFixed(2)}|${description.toLowerCase()}`;
    const duplicate = existingKeys.has(key) || candidates.some(c => `${c.date}|${c.amount.toFixed(2)}|${c.description.toLowerCase()}` === key);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00`));
    const uncertain = !validDate || !description || !amount || !moneyMatches.length;
    // Keyword-based four-way category detection. Keep original OCR description unchanged.
    const category = classifyDescription(description);
    candidates.push({ date, amount, description, category, checked: !duplicate && !uncertain, duplicate, uncertain });
  }

  if (!candidates.length) {
    host.innerHTML = `<div class="ocr-review-card"><strong>No transaction rows detected.</strong><p class="muted-note">OCR found text, but could not confidently pair a transaction amount with a date. Try a clearer screenshot or enter records manually.</p><details><summary>Show recognized text</summary><pre>${escapeHTML(text)}</pre></details></div>`;
    return;
  }
  host.innerHTML = `<div class="ocr-review-card"><div class="ocr-head"><div><strong>Review detected transactions (${candidates.length})</strong><p class="muted-note">OCR can misread descriptions or amounts. Duplicates and uncertain rows start unchecked. Verify every row before importing.</p></div><button class="primary-button" id="confirm-ocr-import">Import checked rows</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Import</th><th>Date</th><th>Description</th><th>Amount (RM)</th><th>Category</th><th>Flag</th></tr></thead><tbody>${candidates.map((c,i)=>`<tr data-ocr-row="${i}"><td><input type="checkbox" data-ocr-check="${i}" ${c.checked?"checked":""}></td><td><input class="field-input" data-ocr-date="${i}" type="date" value="${escapeHTML(c.date)}"></td><td><input class="field-input" data-ocr-description="${i}" value="${escapeHTML(c.description)}"></td><td><input class="field-input" data-ocr-amount="${i}" type="number" min="0.01" step="0.01" value="${c.amount.toFixed(2)}"></td><td><select class="field-input" data-ocr-category="${i}"><option ${c.category==="Food"?"selected":""}>Food</option><option ${c.category==="Drink"?"selected":""}>Drink</option><option ${c.category==="Addon"?"selected":""}>Addon</option><option ${c.category==="Other"?"selected":""}>Other</option></select></td><td>${c.duplicate?"Possible duplicate":c.uncertain?"Check details":"Detected"}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("confirm-ocr-import").addEventListener("click", () => {
    const selected = candidates.map((c,i)=>({c,i})).filter(({i})=>document.querySelector(`[data-ocr-check="${i}"]`)?.checked);
    if (!selected.length) return alert("Select at least one transaction to import.");
    let imported = 0;
    for (const {i} of selected) {
      const date = document.querySelector(`[data-ocr-date="${i}"]`).value;
      const description = document.querySelector(`[data-ocr-description="${i}"]`).value.trim();
      const amount = Number(document.querySelector(`[data-ocr-amount="${i}"]`).value);
      const category = document.querySelector(`[data-ocr-category="${i}"]`).value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || !(amount > 0) || !Number.isFinite(amount)) { alert(`Please correct row ${i+1} before importing.`); return; }
      const key = `${date}|${amount.toFixed(2)}|${description.toLowerCase()}`;
      if (transactions.some(t=>`${t.date}|${Number(t.amount).toFixed(2)}|${(t.description||"").toLowerCase()}`===key)) {
        if (!confirm(`Row ${i+1} looks like an existing transaction. Import it anyway?`)) continue;
      }
      accounts["School Card"] -= amount;
      const importedTransaction = {id:`tx-${nextId++}`,description,account:"School Card",category,type:"expense",amount,date,time:"",source:"screenshot-import"};
      transactions.push(importedTransaction);
      imported++;
    }
    saveState(); renderAll(); showPage("Transactions"); alert(`Imported ${imported} School Card transaction(s). Please reconcile the balance with your actual card balance.`);
  });
}

// Rule A: the first refill is Oct 16, 2026, then every 14 days.
function runSchoolCardResetIfDue() {
  const first = new Date("2026-10-16T00:00:00");
  const todayKey = today();
  const days = Math.floor((new Date(`${todayKey}T00:00:00`) - first) / 86400000);
  if (days < 0) return;
  const cycleIndex = Math.floor(days / 14);
  const dueDate = new Date(first);
  dueDate.setDate(dueDate.getDate() + cycleIndex * 14);
  const dueKey = [dueDate.getFullYear(), String(dueDate.getMonth()+1).padStart(2,"0"), String(dueDate.getDate()).padStart(2,"0")].join("-");
  if (schoolCardLastReset === dueKey) return;
  const leftover = Number(accounts["School Card"] || 0);
  accounts.Cash += leftover;
  accounts["School Card"] = 300;
  schoolCardLastReset = dueKey;
  transactions.push({ id:`reset-${nextId++}`, description:"School Card 14-day refill", account:"School Card", toAccount:"Cash", category:"Reset", type:"reset", amount:300, date:todayKey, time:"", leftoverTransferred:leftover });
  saveState();
}

// ==================================================
// START APP
// ==================================================

if ($("date-button")) {
  $("date-button").title = new Date().toLocaleDateString("en-MY", {
    dateStyle: "full",
  });
}

loadState();
runSchoolCardResetIfDue();
renderAll();
showPage("Home");

console.log("Piggy Bank initialized.");
