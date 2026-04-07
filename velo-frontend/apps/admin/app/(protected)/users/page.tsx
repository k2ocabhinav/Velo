"use client";

import { useEffect, useState } from "react";
import { PageFrame } from "../_components/page-frame";
import { requestAdminProxy } from "../_lib/http";

type UserRow = {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  active?: boolean;
};

type UserPagePayload = {
  content: UserRow[];
  totalPages: number;
  number: number;
};

function displayName(user: UserRow): string {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fullName || user.email;
}

function buildUsersPath(page: number, size = 10): string {
  return `/api/proxy/api/v1/admin/users?page=${page}&size=${size}`;
}

function buildUserToggleRequest(user: UserRow): { path: string; init: RequestInit } {
  const action = user.active ? "deactivate" : "activate";
  return {
    path: `/api/proxy/api/v1/admin/users/${user.id}/${action}`,
    init: { method: "POST" },
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  async function load(targetPage = page): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestAdminProxy<UserPagePayload>(buildUsersPath(targetPage).replace("/api/proxy/", ""));
      setUsers(payload.content ?? []);
      setPage(payload.number ?? targetPage);
      setTotalPages(Math.max(payload.totalPages ?? 1, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
  }, []);

  async function toggleUser(user: UserRow): Promise<void> {
    setSubmittingId(user.id);
    setError(null);
    try {
      const request = buildUserToggleRequest(user);
      await requestAdminProxy(request.path.replace("/api/proxy/", ""), request.init);
      await load(page);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update user status.");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="stack">
      <PageFrame title="Users" description="Monitor rider and driver accounts and state transitions." />

      {error ? <p className="error-text">{error}</p> : null}
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
