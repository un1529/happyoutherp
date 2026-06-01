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
  function setMessage(text, type = "") { message.textContent = text; message.className = `claim-form-message ${type}`.trim(); }
  function setSubmitting(submitting) { submitButton.disabled = submitting; submitButton.textContent = submitting ? "제출 중..." : "청구 제출"; }
  if (!config.url || !config.anonKey || !window.supabase) { setMessage("접수 연결 설정이 완료되지 않았습니다. 회계 담당자에게 알려주세요.", "error"); submitButton.disabled = true; return; }
  const client = window.supabase.createClient(config.url, config.anonKey, { auth: { storageKey: "happyoutherp-public-claim-auth" } });
  function resetCaptcha() { captchaToken = ""; if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId); }
  function renderTurnstile(retries = 0) {
    if (!config.turnstileSiteKey || !turnstileContainer || !turnstileWidget) return;
    turnstileContainer.classList.remove("hide");
    if (!window.turnstile) { if (retries < 50) setTimeout(() => renderTurnstile(retries + 1), 100); return; }
    turnstileWidgetId = window.turnstile.render(turnstileWidget, { sitekey: config.turnstileSiteKey, callback(token) { captchaToken = token; setMessage(""); }, "expired-callback": resetCaptcha, "error-callback": () => { captchaToken = ""; setMessage("자동 제출 방지 확인을 다시 진행해주세요.", "error"); } });
  }
  renderTurnstile();
  function receiptExtension(file) { return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type]; }
  function friendlyError(error) {
    const text = error?.message || String(error);
    if (/anonymous sign-ins are disabled/i.test(text)) return "Supabase에서 Anonymous Sign-Ins가 아직 꺼져 있습니다. 회계 담당자에게 알려주세요.";
    if (/claim-receipts|bucket|receipt_path|receipt_name/i.test(text)) return "영수증 저장소 설정이 아직 완료되지 않았습니다. 회계 담당자에게 알려주세요.";
    if (/captcha/i.test(text)) return "자동 제출 방지 확인을 다시 진행해주세요.";
    if (/public_claims|relation|policy/i.test(text)) return "청구 접수 권한 설정이 아직 완료되지 않았습니다. 회계 담당자에게 알려주세요.";
    return `제출하지 못했습니다: ${text}`;
  }
  async function getAnonymousSession() {
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session?.user?.is_anonymous) return current.data.session;
    if (config.turnstileSiteKey && !captchaToken) throw new Error("자동 제출 방지 확인을 완료해주세요.");
    const result = await client.auth.signInAnonymously({ options: { captchaToken } });
    if (result.error) throw result.error;
    return result.data.session;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); setMessage("");
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.website || Date.now() - startedAt < 1200) { setMessage("잠시 후 다시 제출해주세요.", "error"); return; }
    setSubmitting(true);
    try {
      const session = await getAnonymousSession();
      const receiptFile = form.elements.receipt.files[0];
      const extension = receiptExtension(receiptFile);
      if (!extension || receiptFile.size > 10 * 1024 * 1024) throw new Error("영수증은 JPG, PNG, WEBP, PDF 파일을 10MB 이하로 올려주세요.");
      const receiptPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
      const uploaded = await client.storage.from("claim-receipts").upload(receiptPath, receiptFile, { cacheControl: "3600", contentType: receiptFile.type, upsert: false });
      if (uploaded.error) throw uploaded.error;
      const payload = { submitted_by: session.user.id, requester_name: values.requester_name.trim(), affiliation: values.affiliation.trim() || null, contact: values.contact.trim() || null, track: values.track, used_at: values.used_at, amount: Number(values.amount), vendor: values.vendor.trim(), reason: values.reason.trim(), receipt_path: receiptPath, receipt_name: receiptFile.name };
      const result = await client.from("public_claims").insert(payload);
      if (result.error) { await client.storage.from("claim-receipts").remove([receiptPath]); throw result.error; }
      form.reset(); form.elements.used_at.value = new Date().toISOString().slice(0, 10);
      setMessage("접수되었습니다. 회계 담당자가 내용을 확인합니다.", "success"); resetCaptcha(); await client.auth.signOut({ scope: "local" });
    } catch (error) { setMessage(friendlyError(error), "error"); } finally { setSubmitting(false); }
  });
})();
