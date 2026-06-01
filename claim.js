(function attachPublicClaimForm() {
  const config = window.erpSupabaseConfig || {};
  const form = document.querySelector("[data-public-claim-form]");
  const message = document.querySelector("[data-claim-message]");
  const submitButton = document.querySelector("[data-submit-claim]");
  const turnstileContainer = document.querySelector("[data-turnstile-container]");
  const turnstileWidget = document.querySelector("[data-turnstile-widget]");
  const startedAt = Date.now();
  let captchaToken = "";
  let turnstileWidgetId = null;

  if (!form || !message || !submitButton) return;

  form.elements.used_at.value = new Date().toISOString().slice(0, 10);

  function setMessage(text, type = "") {
    message.textContent = text;
    message.className = `claim-form-message ${type}`.trim();
  }

  function setSubmitting(submitting) {
    submitButton.disabled = submitting;
    submitButton.textContent = submitting ? "제출 중..." : "청구 제출";
  }

  if (!config.url || !config.anonKey || !window.supabase) {
    setMessage("접수 연결 설정이 완료되지 않았습니다. 회계 담당자에게 알려주세요.", "error");
    submitButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      storageKey: "happyoutherp-public-claim-auth",
    },
  });

  function resetCaptcha() {
    captchaToken = "";
    if (turnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function renderTurnstile(retries = 0) {
    if (!config.turnstileSiteKey || !turnstileContainer || !turnstileWidget) return;
    turnstileContainer.classList.remove("hide");
    if (!window.turnstile) {
      if (retries < 50) setTimeout(() => renderTurnstile(retries + 1), 100);
      return;
    }
    turnstileWidgetId = window.turnstile.render(turnstileWidget, {
      sitekey: config.turnstileSiteKey,
      callback(token) {
        captchaToken = token;
        setMessage("");
      },
      "expired-callback": resetCaptcha,
      "error-callback": () => {
        captchaToken = "";
        setMessage("자동 제출 방지 확인을 다시 진행해주세요.", "error");
      },
    });
  }

  renderTurnstile();

  async function getAnonymousSession() {
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session?.user?.is_anonymous) return current.data.session;

    if (config.turnstileSiteKey && !captchaToken) {
      throw new Error("자동 제출 방지 확인을 완료해주세요.");
    }
    const result = await client.auth.signInAnonymously({
      options: {
        captchaToken,
      },
    });
    if (result.error) throw result.error;
    return result.data.session;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("");

    const values = Object.fromEntries(new FormData(form).entries());
    if (values.website || Date.now() - startedAt < 1200) {
      setMessage("잠시 후 다시 제출해주세요.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const session = await getAnonymousSession();
      const payload = {
        submitted_by: session.user.id,
        requester_name: values.requester_name.trim(),
        affiliation: values.affiliation.trim() || null,
        contact: values.contact.trim() || null,
        track: values.track,
        used_at: values.used_at,
        amount: Number(values.amount),
        vendor: values.vendor.trim(),
        reason: values.reason.trim(),
      };
      const result = await client.from("public_claims").insert(payload);
      if (result.error) throw result.error;

      form.reset();
      form.elements.used_at.value = new Date().toISOString().slice(0, 10);
      setMessage("접수되었습니다. 회계 담당자가 내용을 확인합니다.", "success");
      resetCaptcha();
    } catch (error) {
      const setupNeeded = /anonymous|public_claims|relation|policy/i.test(error.message);
      setMessage(
        setupNeeded
          ? "아직 접수 기능이 활성화되지 않았습니다. 회계 담당자에게 알려주세요."
          : `제출하지 못했습니다: ${error.message}`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  });
})();
