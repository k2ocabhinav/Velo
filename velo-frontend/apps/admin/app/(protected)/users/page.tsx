"use client";

import { useEffect, useState } from "react";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { PageFrame } from "../_components/page-frame";
import { adminClient, type UserAccount } from "../_lib/admin-client";
import {
  normalizePageNumber,
  normalizeTotalPages,
  pageFallbackAfterMutation,
  toActionErrorMessage,
} from "../_lib/ui-state";

function displayName(user: UserAccount): string {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName || user.email;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getUsers(targetPage, 10);
      const content = payload.content ?? [];
      const nextPage = normalizePageNumber(payload.number, targetPage);
      const nextTotalPages = normalizeTotalPages(payload.totalPages);
      const fallbackPage = allowFallback
        ? pageFallbackAfterMutation({
            requestedPage: targetPage,
            returnedPage: nextPage,
            totalPages: nextTotalPages,
            itemCount: content.length,
          })
        : null;

      if (fallbackPage !== null && fallbackPage !== targetPage) {
        await load(fallbackPage, false);
        return;
      }

      setUsers(content);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function toggleUser(user: UserAccount): Promise<void> {
    const actionLabel = user.active ? "deactivate" : "activate";
    const actionKey = `toggle-user:${user.id}`;
    if (isActionPending(pendingActions, actionKey)) {
      return;
    }

    if (!window.confirm(`Are you sure you want to ${actionLabel} this user?`)) {
      return;
    }

    setPendingActions((current) => setActionPending(current, actionKey, true));
    setError(null);
    setStatusMessage(null);
    try {
      if (user.active) {
        await adminClient.deactivateUser(user.id);
      } else {
        await adminClient.activateUser(user.id);
      }
      await load(page);
      setStatusMessage(`User ${actionLabel}d.`);
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Unable to update user status."));
    } finally {
      setPendingActions((current) => setActionPending(current, actionKey, false));
    }
  }

  async function handleCreateUser(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.createUser(createForm);
      setStatusMessage("User created successfully.");
      setCreateForm({ firstName: "", lastName: "", email: "", password: "" });
      setShowCreateForm(false);
      await load(page);
    } catch (err) {
      setError(toActionErrorMessage(err, "Unable to create user."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Users" description="Monitor rider and driver accounts and state transitions." />

      <button className="secondary-button" type="button" onClick={() => setShowCreateForm(!showCreateForm)}>
        {showCreateForm ? "Cancel" : "+ Create user"}
      </button>
      {showCreateForm ? (
        <form className="stack" onSubmit={handleCreateUser} style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "8px" }}>
          <div className="grid grid-2">
            <label className="field"><span>First name</span><input value={createForm.firstName} onChange={e => setCreateForm(f => ({...f, firstName: e.target.value}))} required /></label>
            <label className="field"><span>Last name</span><input value={createForm.lastName} onChange={e => setCreateForm(f => ({...f, lastName: e.target.value}))} required /></label>
          </div>
          <label className="field"><span>Email</span><input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({...f, email: e.target.value}))} required /></label>
          <label className="field"><span>Password</span><input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({...f, password: e.target.value}))} required minLength={8} /></label>
          <button className="primary-button" type="submit" disabled={creating}>{creating ? "Creating..." : "Create user"}</button>
        </form>
      ) : null}

      {error ? (
        <div className="row-actions">
          <p className="error-text">{error}</p>
          <button className="secondary-button" type="button" onClick={() => void load(page)}>
            Retry
          </button>
        </div>
      ) : null}
      {statusMessage ? <p className="helper">{statusMessage}</p> : null}
      {loading ? <p className="helper">Loading users...</p> : null}

      {!loading ? (
        <section className="panel metric-card">
          {users.length === 0 ? (
            <p className="helper">No users found on this page.</p>
          ) : (
            <div className="list">
              {users.map((user) => (
                <div key={user.id} className="list-item">
                  <div>
                    <strong>{displayName(user)}</strong>
                    <p>{user.email}</p>
                  </div>
                  <div className="row-actions">
                    <span className="badge" data-tone={user.active ? "success" : "warning"}>
                      {user.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      className={user.active ? "danger-button" : "secondary-button"}
                      type="button"
                      disabled={isActionPending(pendingActions, `toggle-user:${user.id}`)}
                      onClick={() => void toggleUser(user)}
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isActionPending(pendingActions, `onboard:${user.id}`)}
                      onClick={async () => {
                        const vehicleId = window.prompt("Enter vehicle ID for this driver:");
                        if (!vehicleId || !vehicleId.trim()) return;
                        const key = `onboard:${user.id}`;
                        setPendingActions((current) => setActionPending(current, key, true));
                        setError(null);
                        setStatusMessage(null);
                        try {
                          await adminClient.onboardDriver(user.id, vehicleId.trim());
                          setStatusMessage("Driver onboarded successfully.");
                          await load(page);
                        } catch (err) {
                          setError(toActionErrorMessage(err, "Unable to onboard driver."));
                        } finally {
                          setPendingActions((current) => setActionPending(current, key, false));
                        }
                      }}
                    >
                      {isActionPending(pendingActions, `onboard:${user.id}`) ? "Onboarding..." : "Onboard as driver"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pager">
            <button className="secondary-button" type="button" disabled={page <= 0 || loading} onClick={() => void load(page - 1)}>
              Previous
            </button>
            <p className="helper">Page {page + 1} of {totalPages}</p>
            <button className="secondary-button" type="button" disabled={page + 1 >= totalPages || loading} onClick={() => void load(page + 1)}>
              Next
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
