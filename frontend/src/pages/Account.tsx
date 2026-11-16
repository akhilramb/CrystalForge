import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  Clock3,
  FlaskConical,
  LogOut,
  Settings2,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../services/api";

type Profile = {
  full_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  institution?: string | null;
  course_or_role?: string | null;
  created_at?: string | null;
};
type Preferences = {
  theme?: string;
  preferred_units?: string;
  notification_preferences?: Record<string, boolean>;
};

export default function Account({
  section = "dashboard",
}: {
  section?: "dashboard" | "profile" | "settings";
}) {
  const { client, user, recordLogout } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile>({});
  const [prefs, setPrefs] = useState<Preferences>({
    theme: "system",
    preferred_units: "angstrom",
    notification_preferences: {},
  });
  const [logins, setLogins] = useState<
    Array<{
      event_type: string;
      event_time: string;
      authentication_provider: string;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!client || !user) return;
    let live = true;
    void (async () => {
      const [p, pr, h] = await Promise.all([
        client
          .from("profiles")
          .select(
            "full_name,display_name,avatar_url,institution,course_or_role,created_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
        client
          .from("user_preferences")
          .select("theme,preferred_units,notification_preferences")
          .eq("user_id", user.id)
          .maybeSingle(),
        client
          .from("login_history")
          .select("event_type,event_time,authentication_provider")
          .eq("user_id", user.id)
          .order("event_time", { ascending: false })
          .limit(8),
      ]);
      if (!live) return;
      if (p.data) setProfile(p.data as Profile);
      if (pr.data) setPrefs(pr.data as Preferences);
      if (h.data) setLogins(h.data as typeof logins);
      if (p.error || pr.error || h.error)
        setError(
          "Some account details could not be loaded. Check the applied Supabase migration and RLS policies.",
        );
    })();
    return () => {
      live = false;
    };
  }, [client, user]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!client || !user) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: profileError } = await client
        .from("profiles")
        .update({
          full_name: profile.full_name?.trim() || null,
          display_name: profile.display_name?.trim() || null,
          avatar_url: profile.avatar_url?.trim() || null,
          institution: profile.institution?.trim() || null,
          course_or_role: profile.course_or_role?.trim() || null,
        })
        .eq("id", user.id);
      if (profileError) throw profileError;
      if (section === "settings") {
        const { error: prefError } = await client
          .from("user_preferences")
          .upsert(
            {
              user_id: user.id,
              theme: prefs.theme || "system",
              preferred_units: prefs.preferred_units || "angstrom",
              notification_preferences: prefs.notification_preferences || {},
            },
            { onConflict: "user_id" },
          );
        if (prefError) throw prefError;
      }
      setMessage("Your changes have been saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your changes.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await recordLogout().catch(() => undefined);
      await client?.auth.signOut();
      nav("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }
  async function removeAccount() {
    if (!client || !user) return;
    const answer = window.prompt(
      "This permanently deletes your account and its saved data. Type DELETE to confirm.",
    );
    if (answer !== "DELETE") return;
    setBusy(true);
    try {
      await api("/account", undefined, "DELETE");
      await client.auth.signOut();
      nav("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account deletion failed.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    section === "profile"
      ? "Your profile"
      : section === "settings"
        ? "Account settings"
        : "Your research workspace";
  return (
    <div className="container account-page">
      <div className="account-heading">
        <div>
          <span className="eyebrow">CRYSTALFORGE ACCOUNT</span>
          <h1>{title}</h1>
          <p>Manage your identity, saved research, and account preferences.</p>
        </div>
        <button className="ghost" disabled={busy} onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
      <div className="account-grid">
        <aside className="account-nav panel">
          <div className="account-avatar">
            {(profile.display_name || profile.full_name || user?.email || "C")
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <b>{profile.display_name || profile.full_name || "Researcher"}</b>
          <small>{user?.email}</small>
          <Link
            className={section === "dashboard" ? "selected" : ""}
            to="/dashboard"
          >
            <FlaskConical size={17} /> Overview
          </Link>
          <Link
            className={section === "profile" ? "selected" : ""}
            to="/profile"
          >
            <UserRound size={17} /> Profile
          </Link>
          <Link
            className={section === "settings" ? "selected" : ""}
            to="/settings"
          >
            <Settings2 size={17} /> Preferences
          </Link>
          <Link to="/saved">
            <Bookmark size={17} /> Saved materials
          </Link>
          <Link to="/prediction-history">
            <Clock3 size={17} /> Prediction history
          </Link>
        </aside>
        {section === "dashboard" ? (
          <section className="account-content">
            <div className="account-cards">
              <Link className="account-card panel" to="/saved">
                <span className="account-card-icon">
                  <Bookmark />
                </span>
                <b>Saved materials</b>
                <small>Your personal candidate shortlist</small>
                <ArrowUpRight size={17} />
              </Link>
              <Link className="account-card panel" to="/prediction-history">
                <span className="account-card-icon">
                  <Clock3 />
                </span>
                <b>Prediction history</b>
                <small>Runs linked to your account</small>
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="panel account-section">
              <div className="account-section-title">
                <h2>Recent account activity</h2>
                <span className="eyebrow">LATEST 8 EVENTS</span>
              </div>
              {logins.length ? (
                logins.map((x, i) => (
                  <div className="login-event" key={x.event_time + i}>
                    <span className="event-dot" />
                    <span>
                      <b>{x.event_type.replaceAll("_", " ")}</b>
                      <small>{x.authentication_provider}</small>
                    </span>
                    <time>{new Date(x.event_time).toLocaleString()}</time>
                  </div>
                ))
              ) : (
                <p className="account-muted">No login history recorded yet.</p>
              )}
            </div>
            <div className="account-help">
              <span>
                <b>Signed in since</b>
                <small>
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "Account creation date unavailable"}
                </small>
              </span>
              <Link to="/profile">
                Complete your profile <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>
        ) : (
          <section className="panel account-content">
            <form className="account-form" onSubmit={save}>
              {section === "profile" && (
                <>
                  <div className="account-section-title">
                    <h2>Profile information</h2>
                    <span className="eyebrow">PRIVATE TO YOUR ACCOUNT</span>
                  </div>
                  <label>
                    Full name
                    <input
                      maxLength={100}
                      value={profile.full_name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    Display name
                    <input
                      maxLength={80}
                      value={profile.display_name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, display_name: e.target.value })
                      }
                      placeholder="How you want to appear"
                    />
                  </label>
                  <label>
                    Avatar image URL
                    <input
                      type="url"
                      maxLength={500}
                      value={profile.avatar_url || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, avatar_url: e.target.value })
                      }
                      placeholder="https://…"
                    />
                  </label>
                  <label>
                    Institution
                    <input
                      maxLength={160}
                      value={profile.institution || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, institution: e.target.value })
                      }
                      placeholder="University or organization (optional)"
                    />
                  </label>
                  <label>
                    Course or role
                    <input
                      maxLength={120}
                      value={profile.course_or_role || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          course_or_role: e.target.value,
                        })
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Email address
                    <input value={user?.email || ""} readOnly disabled />
                  </label>
                </>
              )}
              {section === "settings" && (
                <>
                  <div className="account-section-title">
                    <h2>Workspace preferences</h2>
                    <span className="eyebrow">SAVED TO YOUR ACCOUNT</span>
                  </div>
                  <label>
                    Theme
                    <select
                      value={prefs.theme || "system"}
                      onChange={(e) =>
                        setPrefs({ ...prefs, theme: e.target.value })
                      }
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                  <label>
                    Preferred length unit
                    <select
                      value={prefs.preferred_units || "angstrom"}
                      onChange={(e) =>
                        setPrefs({ ...prefs, preferred_units: e.target.value })
                      }
                    >
                      <option value="angstrom">Angstrom (Å)</option>
                      <option value="nanometer">Nanometer (nm)</option>
                    </select>
                  </label>
                  <p className="account-muted">
                    Email notifications can be added when a notification
                    workflow is available.
                  </p>
                </>
              )}
              {error && (
                <p className="account-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="account-success" role="status">
                  {message}
                </p>
              )}
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </form>
            {section === "settings" && (
              <div className="account-danger">
                <div>
                  <b>Delete account</b>
                  <small>
                    Permanently remove your profile and account-owned records.
                  </small>
                </div>
                <button
                  className="ghost danger"
                  onClick={removeAccount}
                  disabled={busy}
                >
                  <Trash2 size={16} />
                  Delete account
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
