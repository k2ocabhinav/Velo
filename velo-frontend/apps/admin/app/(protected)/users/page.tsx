"use client";

import { useEffect, useState } from "react";
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
  const [submittingId, setSubmittingId] = useState<number | null>(null);

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
    if (!window.confirm(`Are you sure you want to ${actionLabel} this user?`)) {
      return;
    }

    setSubmittingId(user.id);
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
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Users" description="Monitor rider and driver accounts and state transitions." />

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
                      disabled={submittingId === user.id}
                      onClick={() => void toggleUser(user)}
                    >
                      {user.active ? "Deactivate" : "Activate"}
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
