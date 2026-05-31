(function attachPublicClaimForm() {
  const config = window.erpSupabaseConfig || {};
  const form = document.querySelector("[data-public-claim-form]");
  const message = document.querySelector("[data-claim-message]");
  const submitButton = document.querySelector("[data-submit-claim]");
  const startedAt = Date.now();

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

  async function getAnonymousSession() {
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session?.user?.is_anonymous) return current.data.session;

    const result = await client.auth.signInAnonymously();
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
      const result = await client.from("public_claims").insert(payload).select("id").single();
      if (result.error) throw result.error;

      form.reset();
      form.elements.used_at.value = new Date().toISOString().slice(0, 10);
      setMessage(`접수되었습니다. 접수번호: ${result.data.id.slice(0, 8)}`, "success");
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
