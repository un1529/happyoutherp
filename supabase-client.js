(function createErpBackend() {
  const config = window.erpSupabaseConfig || {};
  const configured = Boolean(config.url && config.anonKey && window.supabase);
  const client = configured ? window.supabase.createClient(config.url, config.anonKey) : null;

  const backend = {
    configured,
    client,
    session: null,
    profile: null,

    async initialize() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      backend.session = data.session;
      if (backend.session) await backend.loadProfile();
      return backend.session;
    },

    async signIn(email, password) {
      if (!client) throw new Error("Supabase 설정이 비어 있습니다.");
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      backend.session = data.session;
      await backend.loadProfile();
      return data.session;
    },

    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      backend.session = null;
      backend.profile = null;
    },

    async loadProfile() {
      const userId = backend.session?.user?.id;
      if (!client || !userId) return null;
      const { data, error } = await client
        .from("profiles")
        .select("id, display_name, role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      backend.profile = data;
      return data;
    },

    async loadSharedState() {
      if (!client || !backend.session) return null;
      const { data, error } = await client
        .from("erp_state")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return data?.data || null;
    },

    async saveSharedState(data) {
      if (!client || !backend.session) return;
      if (!backend.canEdit()) throw new Error("회계담당만 공용 데이터를 수정할 수 있습니다.");
      const payload = {
        id: "main",
        data,
        updated_at: new Date().toISOString(),
        updated_by: backend.session.user.id,
      };
      const { error } = await client.from("erp_state").upsert(payload);
      if (error) throw error;
    },

    canEdit() {
      return backend.profile?.role === "accountant";
    },
  };

  window.erpBackend = backend;
})();
