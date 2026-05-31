(function attachSupabaseIntegration() {
  if (typeof backendEnabled === "function") return;

  const backend = window.erpBackend;
  if (!backend?.configured) return;

  const connectionStatus = document.querySelector("#connectionStatus");
  const logoutButton = document.querySelector("#logoutButton");
  const resetButton = document.querySelector("#resetData");
  let backendMessage = "";

  const originalRender = render;
  const originalSaveData = saveData;
  const originalCanManageMoney = canManageMoney;

  function applyConnectionControls() {
    const connected = Boolean(backend.session);
    connectionStatus.textContent = backendMessage || (connected ? "공용 저장 연결됨" : "로그인 필요");
    connectionStatus.classList.toggle("connected", connected);
    logoutButton.classList.toggle("hide", !connected);
    resetButton.classList.toggle("hide", !backend.canEdit());
    userSelect.classList.toggle("hide", true);

    if (connected && !backend.canEdit()) {
      app.querySelectorAll("form, [data-sync-toss], [data-apply-all-suggestions], [data-confirm-transaction], [data-complete-claim], [data-reject-claim]")
        .forEach((element) => {
          element.classList.add("hide");
        });
    }
  }

  render = function renderWithConnection() {
    originalRender();
    applyConnectionControls();
  };

  saveData = function saveSharedData() {
    originalSaveData();
    if (!backend.session || !backend.canEdit()) return;
    backend
      .saveSharedState(state.data)
      .then(() => {
        backendMessage = "공용 저장 완료";
        applyConnectionControls();
      })
      .catch((error) => {
        backendMessage = `저장 실패: ${error.message}`;
        applyConnectionControls();
      });
  };

  canManageMoney = function connectedMoneyPermission() {
    return backend.canEdit();
  };

  function renderLogin(message = "") {
    connectionStatus.textContent = "로그인 필요";
    logoutButton.classList.add("hide");
    resetButton.classList.add("hide");
    userSelect.classList.add("hide");
    app.innerHTML = `
      <section class="panel login-panel">
        <div class="panel-title">
          <div>
            <h2>로그인</h2>
            <p class="muted">Supabase에 등록된 이메일 계정으로 접속합니다.</p>
          </div>
        </div>
        <form class="login-form" data-connected-login-form>
          <label>이메일
            <input type="email" name="email" autocomplete="email" required />
          </label>
          <label>비밀번호
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <button class="primary-button" type="submit">로그인</button>
          <p class="login-message">${message}</p>
        </form>
      </section>
    `;
  }

  async function hydrateSharedState() {
    const sharedData = await backend.loadSharedState();
    if (sharedData) {
      state.data = sharedData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedData));
      return;
    }

    if (backend.canEdit()) {
      await backend.saveSharedState(state.data);
      backendMessage = "공용 저장소 초기화 완료";
    } else {
      backendMessage = "회계담당이 먼저 공용 데이터를 초기화해야 합니다.";
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      if (backend.canEdit()) return;
      const target = event.target.closest(
        "[data-sync-toss], [data-apply-all-suggestions], [data-confirm-transaction], [data-complete-claim], [data-reject-claim]",
      );
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target.closest("[data-connected-login-form]");
      if (form) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const values = Object.fromEntries(new FormData(form).entries());
        backend
          .signIn(values.email, values.password)
          .then(async () => {
            backendMessage = "공용 저장 연결됨";
            await hydrateSharedState();
            render();
          })
          .catch((error) => renderLogin(`로그인 실패: ${error.message}`));
        return;
      }

      if (!backend.canEdit() && event.target.closest("[data-claim-form]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  logoutButton.addEventListener("click", async () => {
    await backend.signOut();
    backendMessage = "";
    renderLogin();
  });

  resetButton.addEventListener("click", () => {
    if (!backend.canEdit()) return;
    setTimeout(() => backend.saveSharedState(state.data), 0);
  });

  async function bootConnectedApp() {
    try {
      const session = await backend.initialize();
      if (!session) {
        renderLogin();
        return;
      }
      await hydrateSharedState();
      render();
    } catch (error) {
      renderLogin(`연결 실패: ${error.message}`);
    }
  }

  void originalCanManageMoney;
  bootConnectedApp();
})();
