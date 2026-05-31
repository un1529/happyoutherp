const STORAGE_KEY = "happy-youth-erp-v1";

const app = document.querySelector("#app");
const pageTitle = document.querySelector("#pageTitle");
const userSelect = document.querySelector("#userSelect");
const yearSelect = document.querySelector("#yearSelect");

const state = {
  view: "dashboard",
  selectedUserId: "u-accountant",
  selectedYearId: "fy-2026",
  selectedCategoryId: "operation",
  expandedCategoryIds: new Set(["operation"]),
  memberTab: "groups",
  fundFilter: { month: "all", category: "all", kind: "all" },
  data: loadData(),
};

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(window.erpSeed);
  try {
    return JSON.parse(stored);
  } catch {
    return structuredClone(window.erpSeed);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  state.data = structuredClone(window.erpSeed);
  state.selectedUserId = "u-accountant";
  state.selectedYearId = "fy-2026";
  render();
}

function money(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function shortMoney(value) {
  return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
}

function pct(value, total) {
  if (!total) return 0;
  return Math.min(999, Math.round((value / total) * 100));
}

function currentUser() {
  return state.data.users.find((user) => user.id === state.selectedUserId);
}

function currentYear() {
  return state.data.fiscalYears.find((year) => year.id === state.selectedYearId);
}

function categoryById(id) {
  return state.data.categories.find((category) => category.id === id);
}

function categoryName(id) {
  return categoryById(id)?.name || "미분류";
}

function childrenOf(parentId) {
  return state.data.categories.filter((category) => category.parentId === parentId);
}

function descendantsOf(parentId) {
  const direct = childrenOf(parentId);
  return direct.flatMap((category) => [category.id, ...descendantsOf(category.id)]);
}

function budgetFor(categoryId) {
  return state.data.budgets.find((budget) => budget.fiscalYearId === state.selectedYearId && budget.categoryId === categoryId)?.amount || categoryById(categoryId)?.budget || 0;
}

function spentFor(categoryId) {
  const ids = new Set([categoryId, ...descendantsOf(categoryId)]);
  return state.data.transactions
    .filter((transaction) => ids.has(transaction.categoryId))
    .reduce((sum, transaction) => sum + transaction.withdraw, 0);
}

function incomeTotal() {
  return state.data.transactions.reduce((sum, transaction) => sum + transaction.deposit, 0);
}

function expenseTotal() {
  return state.data.transactions.reduce((sum, transaction) => sum + transaction.withdraw, 0);
}

function usageClass(percent) {
  if (percent >= 50) return "high";
  if (percent >= 10) return "mid";
  return "";
}

function statusClass(status) {
  if (status.includes("완료")) return "done";
  if (status.includes("반려")) return "rejected";
  return "waiting";
}

function recommendCategory(text) {
  const normalized = String(text || "").toLowerCase();
  const matched = state.data.classifyRules.find((rule) => {
    const words = rule.keywords.map((keyword) => keyword.toLowerCase());
    return rule.requireAll ? words.every((word) => normalized.includes(word)) : words.some((word) => normalized.includes(word));
  });
  return matched?.categoryId || "";
}

function accountImpact(categoryId, amount) {
  const top = topExpenseCategory(categoryId);
  const spent = spentFor(top?.id || categoryId);
  const budget = budgetFor(top?.id || categoryId);
  const nextPercent = pct(spent + Number(amount || 0), budget);
  return `${top?.name || categoryName(categoryId)} ${nextPercent}% 집행 예상`;
}

function topExpenseCategory(categoryId) {
  let category = categoryById(categoryId);
  while (category?.parentId && category.parentId !== "expense") {
    category = categoryById(category.parentId);
  }
  return category?.type === "expense" ? category : null;
}

function canManageMoney() {
  return currentUser()?.role === "회계";
}

function visibleClaims() {
  if (canManageMoney()) return state.data.reimbursements;
  return state.data.reimbursements.filter((claim) => claim.requesterId === state.selectedUserId);
}

function setView(view) {
  state.view = view;
  render();
  app.focus();
}

function render() {
  renderControls();
  document.querySelectorAll(".menu-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });

  const titles = {
    dashboard: "메인",
    budget: "예산",
    category: categoryName(state.selectedCategoryId),
    members: "회원",
    claims: "청구",
    funds: "자금현황",
  };

  if (pageTitle) pageTitle.textContent = titles[state.view] || "메인";

  if (state.view === "budget") app.innerHTML = renderYearLayout("budget", renderBudget());
  if (state.view === "category") app.innerHTML = renderYearLayout("budget", renderCategoryDetail(), categoryName(state.selectedCategoryId));
  if (state.view === "members") app.innerHTML = renderYearLayout("members", renderMembers());
  if (state.view === "claims") app.innerHTML = renderYearLayout("claims", renderClaims());
  if (state.view === "funds") app.innerHTML = renderYearLayout("funds", renderFunds());
  if (state.view === "dashboard") app.innerHTML = renderDashboard();
}

function renderYearLayout(activeView, content, detailTitle = "") {
  const year = currentYear();
  const tabs = [
    ["budget", "예산"],
    ["members", "회원"],
    ["claims", "청구"],
    ["funds", "자금현황"],
  ];
  const tabName = tabs.find(([id]) => id === activeView)?.[1] || "예산";
  return `
    <div class="year-header">
      <div class="breadcrumb">
        <button data-view="dashboard">메인</button>
        <span> › </span>
        <strong>${year.round} / ${year.year}년</strong>
        <span> › </span>
        <strong>${tabName}${detailTitle ? ` / ${detailTitle}` : ""}</strong>
      </div>
      <nav class="year-tabs" aria-label="회계년도 메뉴">
        ${tabs.map(([id, label]) => `<button class="${id === activeView ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}
      </nav>
    </div>
    ${content}
  `;
}

function renderControls() {
  userSelect.innerHTML = state.data.users
    .map((user) => `<option value="${user.id}" ${user.id === state.selectedUserId ? "selected" : ""}>${user.name} · ${user.role}</option>`)
    .join("");

  yearSelect.innerHTML = state.data.fiscalYears
    .map((year) => `<option value="${year.id}" ${year.id === state.selectedYearId ? "selected" : ""}>${year.year}년</option>`)
    .join("");
}

function renderDashboard() {
  const user = currentUser();
  const pendingClaims = state.data.reimbursements.filter((claim) => claim.status.includes("대기")).length;
  const unclassified = state.data.transactions.filter((transaction) => !transaction.categoryId).length;
  const doneThisMonth = state.data.reimbursements.filter((claim) => claim.status === "송금완료").length;
  const roleNotice = user.role === "청년회원" ? "내 청구 중심으로 표시됩니다." : "조회는 공개, 편집·승인은 회계 권한입니다.";

  return `
    <div class="stack">
      <section class="panel">
        <div class="panel-title">
          <div>
            <h2>${user.name}님, 안녕하세요</h2>
            <p class="muted">직전 로그인 ${user.lastLogin} · ${roleNotice}</p>
          </div>
          <button class="secondary-button" data-view="claims">내 청구 보기</button>
        </div>
        <div class="main-menu" aria-label="주요 메뉴">
          <button data-view="budget">예산</button>
          <button data-view="members">회원</button>
          <button data-view="claims">청구</button>
          <button data-view="funds">자금현황</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h2>미처리 내역</h2><span class="muted">회계 기준</span></div>
        <div class="grid four">
          ${metricCard("청구 검토대기", pendingClaims, "미처리")}
          ${metricCard("임포트 확인", 2, "스테이징")}
          ${metricCard("헌금 매칭", offeringUnmatched(), "미입금·부분")}
          ${metricCard("미분류 거래", unclassified, "분류 필요")}
        </div>
      </section>

      <section class="grid two">
        <div class="panel">
          <div class="panel-title"><h2>이번 달 처리</h2></div>
          <div class="grid three">
            ${metricCard("청구 승인", doneThisMonth, "건")}
            ${metricCard("거래 입력", state.data.transactions.length, "건")}
            ${metricCard("보고서 출력", 0, "준비중")}
          </div>
        </div>
        <div class="panel">
          <div class="panel-title"><h2>알림·공지</h2></div>
          <div class="stack">
            ${state.data.notices.map((notice) => `<div class="notice"><strong>${notice.title}</strong><p>${notice.body}</p></div>`).join("")}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title"><h2>회계년도</h2><span class="muted">카드를 선택하면 해당 회계년도 기준으로 봅니다</span></div>
        <div class="grid two">
          ${state.data.fiscalYears.map(renderFiscalCard).join("")}
        </div>
      </section>
    </div>
  `;
}

function metricCard(title, value, caption) {
  return `
    <div class="card metric">
      <span>${title}</span>
      <strong>${value}</strong>
      <span>${caption}</span>
    </div>
  `;
}

function renderFiscalCard(year) {
  const totalBudget = state.data.budgets.filter((budget) => budget.fiscalYearId === year.id).reduce((sum, budget) => sum + budget.amount, 0);
  const used = expenseTotal();
  const percent = pct(used, totalBudget);
  return `
    <button class="card category-button" data-year-card="${year.id}">
      <div class="panel-title">
        <h3>${year.round} · ${year.year}년</h3>
        <span class="status ${year.closed ? "done" : "waiting"}">${year.closed ? "마감" : "운영중"}</span>
      </div>
      <p class="muted">목사 ${year.pastor} · 회장 ${year.president} · 부장 ${year.director}</p>
      <div class="battery"><div class="battery-fill ${usageClass(percent)}" style="width:${Math.min(percent, 100)}%"></div></div>
      <p><strong>${percent}%</strong> 집행 · 통장잔액 ${money(year.balance)}</p>
      <p class="muted">${year.start} ~ ${year.end}</p>
    </button>
  `;
}

function renderBudget() {
  const topCategories = childrenOf("expense");
  const totalBudget = topCategories.reduce((sum, category) => sum + budgetFor(category.id), 0);
  const spent = expenseTotal();
  const months = monthlyRows();

  return `
    <div class="stack">
      <section class="grid two">
        ${summaryCard("통장 잔액", money(currentYear().balance), "전월 대비 +1,240,000원")}
        ${summaryCard("연간 예산 집행률", `${pct(spent, totalBudget)}%`, `${money(spent)} / ${money(totalBudget)}`)}
      </section>

      <section class="panel">
        <div class="panel-title">
          <h2>카테고리별 집행 현황</h2>
          <span class="muted">파랑 10% 미만 · 노랑 10~50% · 빨강 50% 이상</span>
        </div>
        ${topCategories.map(renderBudgetRow).join("")}
      </section>

      <section class="grid two">
        <div class="table-wrap">
          <table>
            <thead><tr><th>월</th><th>수입</th><th>지출</th><th>순</th></tr></thead>
            <tbody>${months.map((row) => `<tr><td>${row.month}월</td><td>${shortMoney(row.income)}</td><td>${shortMoney(row.expense)}</td><td>${shortMoney(row.income - row.expense)}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-title"><h2>분기 요약</h2></div>
          <div class="grid two">
            ${[1, 2, 3, 4].map((quarter) => quarterCard(quarter, months)).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function summaryCard(title, value, caption) {
  return `
    <div class="panel metric">
      <span>${title}</span>
      <strong>${value}</strong>
      <span>${caption}</span>
    </div>
  `;
}

function renderBudgetRow(category) {
  const budget = budgetFor(category.id);
  const spent = spentFor(category.id);
  const percent = pct(spent, budget);
  const expanded = state.expandedCategoryIds.has(category.id);
  const children = childrenOf(category.id);

  return `
    <div class="budget-row">
      <button class="category-button" data-category-detail="${category.id}">${category.name}</button>
      <div class="battery"><div class="battery-fill ${usageClass(percent)}" style="width:${Math.min(percent, 100)}%"></div></div>
      <strong>${percent}%</strong>
      <button class="secondary-button" data-toggle-category="${category.id}">${expanded ? "접기" : "펼침"}</button>
      ${
        expanded
          ? `<div class="sub-list">${children.map((child) => renderSubBudget(child)).join("")}</div>`
          : ""
      }
    </div>
  `;
}

function renderSubBudget(category) {
  const spent = spentFor(category.id);
  const parentBudget = budgetFor(category.parentId);
  const percent = pct(spent, parentBudget);
  return `
    <div class="sub-item">
      <button class="category-button" data-category-detail="${category.id}">${category.name}</button>
      <div class="battery"><div class="battery-fill ${usageClass(percent)}" style="width:${Math.min(percent, 100)}%"></div></div>
      <span>${shortMoney(spent)}</span>
    </div>
  `;
}

function monthlyRows() {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const prefix = `2026-${String(month).padStart(2, "0")}`;
    const rows = state.data.transactions.filter((transaction) => transaction.date.startsWith(prefix));
    return {
      month,
      income: rows.reduce((sum, row) => sum + row.deposit, 0),
      expense: rows.reduce((sum, row) => sum + row.withdraw, 0),
    };
  });
}

function quarterCard(quarter, months) {
  const rows = months.slice((quarter - 1) * 3, quarter * 3);
  const income = rows.reduce((sum, row) => sum + row.income, 0);
  const expense = rows.reduce((sum, row) => sum + row.expense, 0);
  return `
    <div class="card metric">
      <span>Q${quarter}</span>
      <strong>${shortMoney(income - expense)}</strong>
      <span>수입 ${shortMoney(income)} · 지출 ${shortMoney(expense)}</span>
    </div>
  `;
}

function renderCategoryDetail() {
  const category = categoryById(state.selectedCategoryId);
  const top = topExpenseCategory(category.id) || category;
  const budget = budgetFor(top.id);
  const spent = spentFor(category.id);
  const remaining = Math.max(0, budget - spentFor(top.id));
  const ids = new Set([category.id, ...descendantsOf(category.id)]);
  const transactions = state.data.transactions.filter((transaction) => ids.has(transaction.categoryId));
  const pending = state.data.transactions.filter((transaction) => !transaction.categoryId && recommendCategory(transaction.memo));

  return `
    <div class="stack">
      <section class="grid three">
        ${summaryCard("배정 예산", money(budget), top.name)}
        ${summaryCard("선택 항목 집행", money(spent), category.name)}
        ${summaryCard("상위 잔여 예산", money(remaining), top.name)}
      </section>
      <section class="panel">
        <div class="panel-title"><h2>세부 항목</h2><button class="secondary-button" data-view="budget">예산 전체</button></div>
        ${childrenOf(category.id).length ? childrenOf(category.id).map(renderSubBudget).join("") : `<div class="empty">하위 항목이 없습니다.</div>`}
      </section>
      <section class="split-layout">
        <div class="table-wrap">
          <table>
            <thead><tr><th>날짜</th><th>내용</th><th>출금</th><th>출처</th></tr></thead>
            <tbody>${transactions.map((row) => `<tr><td>${row.date}</td><td>${row.memo}</td><td>${money(row.withdraw)}</td><td>${row.source}</td></tr>`).join("") || `<tr><td colspan="4">거래가 없습니다.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-title"><h2>분류 추천 대기</h2></div>
          <div class="stack">
            ${pending.map((row) => recommendationCard(row)).join("") || `<div class="empty">추천 대기 건이 없습니다.</div>`}
          </div>
        </div>
      </section>
    </div>
  `;
}

function recommendationCard(row) {
  const suggestion = recommendCategory(row.memo);
  return `
    <div class="claim-card">
      <div class="claim-head">
        <strong>${row.memo}</strong>
        <span class="pill">${categoryName(suggestion)}</span>
      </div>
      <p class="muted">${row.date} · ${money(row.withdraw || row.deposit)}</p>
      <div class="actions">
        <button class="primary-button" data-confirm-transaction="${row.id}" data-category="${suggestion}">확정</button>
        <button class="secondary-button" data-view="funds">원장 보기</button>
      </div>
    </div>
  `;
}

function renderClaims() {
  const claims = visibleClaims();
  const counts = ["1차검토 대기", "회계 승인대기", "송금완료", "반려"].map((status) => ({
    status,
    count: claims.filter((claim) => claim.status === status).length,
  }));

  return `
    <div class="stack">
      <section class="grid four">
        ${counts.map((item) => metricCard(item.status, item.count, "건")).join("")}
      </section>
      <section class="split-layout">
        <div class="panel">
          <div class="panel-title"><h2>청구 목록</h2><span class="muted">${canManageMoney() ? "회계 처리 화면" : "내 청구"}</span></div>
          ${claims.map(renderClaimCard).join("") || `<div class="empty">청구가 없습니다.</div>`}
        </div>
        <div class="panel" id="claimForm">
          <div class="panel-title"><h2>청구 작성</h2></div>
          <form class="form-grid" data-claim-form>
            <label>트랙
              <select name="track">
                <option>선지출</option>
                <option>선승인</option>
              </select>
            </label>
            <label>사용일
              <input type="date" name="date" value="2026-05-31" required />
            </label>
            <label>금액
              <input type="number" name="amount" min="0" step="100" required />
            </label>
            <label>사용처
              <input name="vendor" placeholder="예: 카페온" required />
            </label>
            <label class="full">사유
              <textarea name="reason" rows="3" placeholder="예: 소망순 다과 및 심방" required></textarea>
            </label>
            <label>연결 대상
              <input name="linked" value="${groupName(currentUser().groupId)}" />
            </label>
            <label>입금계좌
              <input name="account" value="${currentUser().account}" />
            </label>
            <div class="full actions">
              <button class="primary-button" type="submit">청구 저장</button>
              <span class="muted">사유를 읽어 카테고리를 추천합니다.</span>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;
}

function renderClaimCard(claim) {
  const suggested = claim.categoryId || recommendCategory(`${claim.vendor} ${claim.reason}`);
  const categoryId = claim.categoryId || suggested;
  return `
    <article class="claim-card">
      <div class="claim-head">
        <div>
          <strong>${claim.requester} · ${money(claim.amount)}</strong>
          <p class="muted">${claim.vendor} · ${claim.reason}</p>
        </div>
        <span class="status ${statusClass(claim.status)}">${claim.status}</span>
      </div>
      <dl class="detail-list">
        <div><dt>트랙</dt><dd>${claim.track}${claim.track === "선승인" ? " 요청" : ""}</dd></div>
        <div><dt>추천 카테고리</dt><dd>${categoryName(categoryId)}</dd></div>
        <div><dt>1차검토</dt><dd>${claim.firstReview}</dd></div>
        <div><dt>예산 영향</dt><dd>${accountImpact(categoryId, claim.amount)}</dd></div>
        <div><dt>입금계좌</dt><dd>${claim.account}</dd></div>
        <div><dt>영수증</dt><dd>${claim.receipt}</dd></div>
      </dl>
      ${
        canManageMoney() && claim.status !== "송금완료"
          ? `<div class="actions">
              <button class="danger-button" data-reject-claim="${claim.id}">반려</button>
              <button class="primary-button" data-complete-claim="${claim.id}" data-category="${categoryId}">송금완료</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderFunds() {
  const filtered = filteredTransactions();
  const income = filtered.reduce((sum, row) => sum + row.deposit, 0);
  const expense = filtered.reduce((sum, row) => sum + row.withdraw, 0);
  const categories = state.data.categories.filter((category) => category.type === "expense" || category.type === "income");

  return `
    <div class="stack">
      <section class="grid three">
        ${summaryCard("통장 잔액", money(currentYear().balance), "토스뱅크 1계좌")}
        ${summaryCard("필터 수입", money(income), "선택 조건 기준")}
        ${summaryCard("필터 지출", money(expense), "선택 조건 기준")}
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2>거래원장</h2>
          <div class="actions">
            <button class="secondary-button" data-sync-toss>업데이트</button>
            <button class="primary-button" data-apply-all-suggestions>추천 모두 확정</button>
          </div>
        </div>
        <div class="form-grid">
          <label>월
            <select data-filter="month">
              <option value="all">전체</option>
              ${Array.from({ length: 12 }, (_, index) => `<option value="${String(index + 1).padStart(2, "0")}" ${state.fundFilter.month === String(index + 1).padStart(2, "0") ? "selected" : ""}>${index + 1}월</option>`).join("")}
            </select>
          </label>
          <label>카테고리
            <select data-filter="category">
              <option value="all">전체</option>
              ${categories.map((category) => `<option value="${category.id}" ${state.fundFilter.category === category.id ? "selected" : ""}>${category.name}</option>`).join("")}
            </select>
          </label>
          <label>수입/지출
            <select data-filter="kind">
              <option value="all">전체</option>
              <option value="income" ${state.fundFilter.kind === "income" ? "selected" : ""}>수입</option>
              <option value="expense" ${state.fundFilter.kind === "expense" ? "selected" : ""}>지출</option>
            </select>
          </label>
        </div>
      </section>
      <section class="table-wrap">
        <table>
          <thead><tr><th>날짜</th><th>내용</th><th>입금</th><th>출금</th><th>잔액</th><th>분류</th><th>작업</th></tr></thead>
          <tbody>${filtered.map(renderTransactionRow).join("")}</tbody>
        </table>
      </section>
      <section class="panel">
        <div class="panel-title"><h2>헌금 매칭</h2></div>
        <div class="grid three">
          ${state.data.offerings.map((offering) => {
            const done = offering.amount === offering.matched;
            const partial = offering.matched > 0 && !done;
            return `<div class="card metric"><span>${offering.week} · ${offering.kind}</span><strong>${shortMoney(offering.amount)}</strong><span class="status ${done ? "done" : "waiting"}">${done ? "완료" : partial ? "부분" : "미입금"}</span></div>`;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function filteredTransactions() {
  return state.data.transactions.filter((transaction) => {
    const monthOk = state.fundFilter.month === "all" || transaction.date.slice(5, 7) === state.fundFilter.month;
    const categoryOk = state.fundFilter.category === "all" || transaction.categoryId === state.fundFilter.category;
    const kindOk =
      state.fundFilter.kind === "all" ||
      (state.fundFilter.kind === "income" && transaction.deposit > 0) ||
      (state.fundFilter.kind === "expense" && transaction.withdraw > 0);
    return monthOk && categoryOk && kindOk;
  });
}

function renderTransactionRow(row) {
  const suggestion = row.categoryId ? "" : recommendCategory(row.memo);
  return `
    <tr class="${row.categoryId ? "" : "unclassified"}">
      <td>${row.date}</td>
      <td>${row.memo}</td>
      <td>${row.deposit ? money(row.deposit) : "-"}</td>
      <td>${row.withdraw ? money(row.withdraw) : "-"}</td>
      <td>${money(row.balance)}</td>
      <td>${row.categoryId ? `<span class="tag">${categoryName(row.categoryId)}</span>` : `<span class="status waiting">분류?</span>`}</td>
      <td>
        ${
          suggestion
            ? `<button class="secondary-button" data-confirm-transaction="${row.id}" data-category="${suggestion}">${categoryName(suggestion)}</button>`
            : "-"
        }
      </td>
    </tr>
  `;
}

function renderMembers() {
  const tabs = [
    ["groups", "순"],
    ["teams", "팀"],
    ["leaders", "임원·리더"],
    ["all", "전체 회원"],
  ];
  return `
    <div class="stack">
      <section class="panel">
        <div class="pill-row">
          ${tabs.map(([id, label]) => `<button class="${state.memberTab === id ? "primary-button" : "secondary-button"}" data-member-tab="${id}">${label}</button>`).join("")}
        </div>
      </section>
      <section class="panel">
        ${renderMemberTab()}
      </section>
    </div>
  `;
}

function renderMemberTab() {
  if (state.memberTab === "teams") {
    return `
      <div class="stack">
        ${state.data.teams.map((team) => `<div class="member-row"><strong>${team.name}</strong><span>팀장 ${team.leader}</span><span>${money(team.spent)} 사용</span></div>`).join("")}
      </div>
    `;
  }

  if (state.memberTab === "leaders") {
    return `
      <div class="stack">
        ${state.data.users.filter((user) => user.role !== "청년회원").map((user) => `<div class="member-row"><strong>${user.name}</strong><span>${user.role}</span><span>${groupName(user.groupId)}</span></div>`).join("")}
      </div>
    `;
  }

  if (state.memberTab === "all") {
    const names = state.data.groups.flatMap((group) => group.members.map((member) => ({ member, group: group.name })));
    return `<div class="chip-list">${names.map((item) => `<span class="pill">${item.member} · ${item.group}</span>`).join("")}</div>`;
  }

  return `
    <div class="stack">
      ${state.data.groups.map((group) => {
        const leader = state.data.users.find((user) => user.id === group.leaderId)?.name || "미지정";
        return `
          <div class="claim-card">
            <div class="claim-head">
              <strong>${group.name}</strong>
              <span class="pill">순장 ${leader}</span>
            </div>
            <div class="chip-list">${group.members.map((member) => `<span class="tag">${member}</span>`).join("")}</div>
            <p class="muted">심방비 한도 자동 계산: ${group.members.length}명 x 30,000원 = ${money(group.members.length * 30000)}</p>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function groupName(groupId) {
  return state.data.groups.find((group) => group.id === groupId)?.name || "";
}

function offeringUnmatched() {
  return state.data.offerings.filter((offering) => offering.amount !== offering.matched).length;
}

function addClaim(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const user = currentUser();
  const categoryId = recommendCategory(`${values.vendor} ${values.reason}`);
  const isSelfReviewer = state.data.groups.find((group) => group.id === user.groupId)?.leaderId === user.id;
  const claim = {
    id: `rb-${Date.now()}`,
    requesterId: user.id,
    requester: user.name,
    track: values.track,
    amount: Number(values.amount),
    date: values.date,
    vendor: values.vendor,
    reason: values.reason,
    categoryId,
    linked: values.linked,
    receipt: "첨부 대기",
    account: values.account,
    firstReview: isSelfReviewer ? "자동 통과" : `${groupName(user.groupId)} 1차검토`,
    status: isSelfReviewer ? "회계 승인대기" : "1차검토 대기",
  };
  state.data.reimbursements.unshift(claim);
  saveData();
  render();
}

function completeClaim(claimId, categoryId) {
  const claim = state.data.reimbursements.find((item) => item.id === claimId);
  if (!claim) return;
  claim.status = "송금완료";
  claim.categoryId = categoryId || claim.categoryId || recommendCategory(`${claim.vendor} ${claim.reason}`);
  claim.firstReview = claim.firstReview || "자동 통과";

  const latestBalance = state.data.transactions.at(-1)?.balance || currentYear().balance;
  state.data.transactions.push({
    id: `tr-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    memo: `${claim.vendor} · ${claim.reason}`,
    deposit: 0,
    withdraw: Number(claim.amount),
    balance: latestBalance - Number(claim.amount),
    categoryId: claim.categoryId,
    source: "청구",
    linked: claim.linked,
  });
  currentYear().balance = latestBalance - Number(claim.amount);
  saveData();
  render();
}

function rejectClaim(claimId) {
  const claim = state.data.reimbursements.find((item) => item.id === claimId);
  if (!claim) return;
  claim.status = "반려";
  saveData();
  render();
}

function confirmTransaction(transactionId, categoryId) {
  const transaction = state.data.transactions.find((item) => item.id === transactionId);
  if (!transaction) return;
  transaction.categoryId = categoryId;
  saveData();
  render();
}

function applyAllSuggestions() {
  state.data.transactions.forEach((transaction) => {
    if (!transaction.categoryId) {
      transaction.categoryId = recommendCategory(transaction.memo);
    }
  });
  saveData();
  render();
}

function syncTossMock() {
  const exists = state.data.transactions.some((transaction) => transaction.memo === "신입생 환영회 배너");
  if (exists) return;
  const latestBalance = state.data.transactions.at(-1)?.balance || currentYear().balance;
  state.data.transactions.push(
    {
      id: `tr-${Date.now()}-1`,
      date: "2026-05-29",
      memo: "신입생 환영회 배너",
      deposit: 0,
      withdraw: 88000,
      balance: latestBalance - 88000,
      categoryId: "",
      source: "스테이징",
      linked: "신규",
    },
    {
      id: `tr-${Date.now()}-2`,
      date: "2026-05-30",
      memo: "토스뱅크 이자",
      deposit: 1200,
      withdraw: 0,
      balance: latestBalance - 86800,
      categoryId: "interest-income",
      source: "스테이징",
      linked: "소액",
    },
  );
  currentYear().balance = latestBalance - 86800;
  saveData();
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.view) {
    setView(target.dataset.view);
    return;
  }

  if (target.dataset.yearCard) {
    state.selectedYearId = target.dataset.yearCard;
    setView("budget");
    return;
  }

  if (target.dataset.toggleCategory) {
    const id = target.dataset.toggleCategory;
    if (state.expandedCategoryIds.has(id)) state.expandedCategoryIds.delete(id);
    else state.expandedCategoryIds.add(id);
    render();
    return;
  }

  if (target.dataset.categoryDetail) {
    state.selectedCategoryId = target.dataset.categoryDetail;
    setView("category");
    return;
  }

  if (target.dataset.memberTab) {
    state.memberTab = target.dataset.memberTab;
    render();
    return;
  }

  if (target.dataset.completeClaim) {
    completeClaim(target.dataset.completeClaim, target.dataset.category);
    return;
  }

  if (target.dataset.rejectClaim) {
    rejectClaim(target.dataset.rejectClaim);
    return;
  }

  if (target.dataset.confirmTransaction) {
    confirmTransaction(target.dataset.confirmTransaction, target.dataset.category);
    return;
  }

  if (target.dataset.applyAllSuggestions !== undefined) {
    applyAllSuggestions();
    return;
  }

  if (target.dataset.syncToss !== undefined) {
    syncTossMock();
    return;
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-claim-form]");
  if (!form) return;
  event.preventDefault();
  addClaim(form);
});

document.addEventListener("change", (event) => {
  if (event.target === userSelect) {
    state.selectedUserId = event.target.value;
    render();
    return;
  }

  if (event.target === yearSelect) {
    state.selectedYearId = event.target.value;
    render();
    return;
  }

  if (event.target.dataset.filter) {
    state.fundFilter[event.target.dataset.filter] = event.target.value;
    render();
  }
});

document.querySelector("#resetData").addEventListener("click", resetData);

render();
