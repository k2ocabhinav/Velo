"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Button, ConfirmDialog, DataTable, EmptyState, ErrorState, Field, PageHeader, Pagination, Section, Select, Sheet, Skeleton, StatusBadge,
  type DataTableColumn,
} from "@velo/ui";
import { isActionPending, setActionPending } from "@velo/app-core/async-actions";
import { adminClient, type UserAccount } from "../_lib/admin-client";
import { normalizePageNumber, normalizeTotalPages, pageFallbackAfterMutation, toActionErrorMessage } from "../_lib/ui-state";

function displayName(user: UserAccount): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function userRoles(user: UserAccount): string[] {
  return (user.roles ?? []).map((role) => role.toUpperCase()).filter(Boolean);
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = { RIDER: "Rider", DRIVER: "Driver", ADMIN: "Admin" };
  return labels[role] ?? "Member";
}

function isRiderOnly(user: UserAccount): boolean {
  const roles = new Set(userRoles(user));
  return roles.has("RIDER") && !roles.has("DRIVER") && !roles.has("ADMIN");
}

type ConfirmAction = { title: string; description: string; confirmLabel: string; run: () => Promise<void> };

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [onboardUser, setOnboardUser] = useState<UserAccount | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  async function load(targetPage = page, allowFallback = true): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminClient.getUsers(targetPage, 10);
      const rows = payload.content ?? [];
      const nextPage = normalizePageNumber(payload.number, targetPage);
      const nextTotalPages = normalizeTotalPages(payload.totalPages);
      const fallback = allowFallback ? pageFallbackAfterMutation({ requestedPage: targetPage, returnedPage: nextPage, totalPages: nextTotalPages, itemCount: rows.length }) : null;
      if (fallback !== null && fallback !== targetPage) return await load(fallback, false);
      setUsers(rows);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
    } catch (loadError) {
      setError(toActionErrorMessage(loadError, "Couldn't load users."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(0); }, []);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const searchable = `${displayName(user)} ${user.email}`.toLowerCase();
    return searchable.includes(query.trim().toLowerCase()) && (roleFilter === "ALL" || userRoles(user).includes(roleFilter));
  }), [users, query, roleFilter]);

  async function mutateUser(user: UserAccount, action: "activate" | "deactivate" | "delete"): Promise<void> {
    const key = `${action}:${user.id}`;
    if (isActionPending(pendingActions, key)) return;
    setPendingActions((current) => setActionPending(current, key, true));
    setError(null);
    setStatusMessage(null);
    try {
      if (action === "activate") await adminClient.activateUser(user.id);
      else if (action === "deactivate") await adminClient.deactivateUser(user.id);
      else await adminClient.deleteRider(user.id);
      await load(page);
      setStatusMessage(action === "delete" ? "Rider removed from active operations." : `User ${action}d.`);
    } catch (actionError) {
      setError(toActionErrorMessage(actionError, "Couldn't update this user."));
    } finally {
      setPendingActions((current) => setActionPending(current, key, false));
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.createUser(createForm);
      setCreateForm({ firstName: "", lastName: "", email: "", password: "" });
      setCreateOpen(false);
      await load(page);
      setStatusMessage("Rider created.");
    } catch (createError) {
      setError(toActionErrorMessage(createError, "Couldn't create rider."));
    } finally {
      setCreating(false);
    }
  }

  async function onboardDriver(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!onboardUser || !vehicleId.trim()) return;
    const key = `onboard:${onboardUser.id}`;
    setPendingActions((current) => setActionPending(current, key, true));
    setError(null);
    setStatusMessage(null);
    try {
      await adminClient.onboardDriver(onboardUser.id, vehicleId.trim());
      setOnboardUser(null);
      setVehicleId("");
      await load(page);
      setStatusMessage("Driver onboarded.");
    } catch (onboardError) {
      setError(toActionErrorMessage(onboardError, "Couldn't onboard this driver."));
    } finally {
      setPendingActions((current) => setActionPending(current, key, false));
    }
  }

  const columns: DataTableColumn<UserAccount>[] = [
    { header: "Name", cell: (user) => <strong>{displayName(user)}</strong> },
    { header: "Email", accessorKey: "email" },
    { header: "Role", cell: (user) => userRoles(user).map(roleLabel).join(", ") || "Member" },
    { header: "Status", cell: (user) => <StatusBadge domain="user" status={user.active ? "ACTIVE" : "INACTIVE"} /> },
  ];

  return (
    <div className="stack">
      <PageHeader title="Users" description="Find accounts and manage access." actions={<Button onClick={() => setCreateOpen(true)}>Create rider</Button>} />
      {error ? <ErrorState title="Couldn't update users" description={error} onRetry={() => void load(page)} /> : null}
      {statusMessage ? <p role="status" className="helper">{statusMessage}</p> : null}

      <Section title="All users" actions={<span className="helper">{users.length} shown on this page</span>}>
        <div className="grid grid-2" style={{ marginBottom: "var(--space-4)" }}>
          <Field label="Search users"><input className="ui-control" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" /></Field>
          <Field label="Filter by role"><Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">All roles</option><option value="RIDER">Rider</option><option value="DRIVER">Driver</option><option value="ADMIN">Admin</option></Select></Field>
        </div>
        {loading ? (
          <div aria-label="Loading users" aria-busy="true" className="stack">
            {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-12" key={index} />)}
          </div>
        ) : (
          <DataTable
            data={visibleUsers}
            columns={columns}
            getRowKey={(user) => user.id}
            ariaLabel="Users"
            emptyState={<EmptyState title={users.length ? "No users match these filters" : "No users yet"} description={users.length ? "Try a different search or role." : "Create a rider account to get started."} action={users.length ? <Button variant="secondary" onClick={() => { setQuery(""); setRoleFilter("ALL"); }}>Clear filters</Button> : <Button onClick={() => setCreateOpen(true)}>Create rider</Button>} />}
            rowActions={(user) => [
              user.active
                ? { label: "Deactivate", destructive: true, onSelect: () => setConfirmAction({ title: "Deactivate user?", description: `This will suspend access for ${displayName(user)}.`, confirmLabel: "Deactivate user", run: () => mutateUser(user, "deactivate") }) }
                : { label: "Activate", onSelect: () => void mutateUser(user, "activate") },
              { label: "Make driver", onSelect: () => { setOnboardUser(user); setVehicleId(""); } },
              ...(isRiderOnly(user) ? [{ label: "Delete rider", destructive: true, onSelect: () => setConfirmAction({ title: "Remove rider?", description: "This action deactivates the rider's access to active operations.", confirmLabel: "Delete rider", run: () => mutateUser(user, "delete") }) }] : []),
            ]}
            rowActionsLabel={(user) => `Actions for ${displayName(user)}`}
          />
        )}
        {!loading ? <Pagination page={page + 1} totalPages={totalPages} onPageChange={(nextPage) => void load(nextPage - 1)} /> : null}
      </Section>

      <Sheet open={createOpen} onOpenChange={setCreateOpen} title="Create rider" description="Add a new rider account.">
        <form className="stack" onSubmit={(event) => void createUser(event)}>
          <div className="admin-form-grid">
            <Field label="First name"><input className="ui-control" value={createForm.firstName} onChange={(event) => setCreateForm((form) => ({ ...form, firstName: event.target.value }))} required /></Field>
            <Field label="Last name"><input className="ui-control" value={createForm.lastName} onChange={(event) => setCreateForm((form) => ({ ...form, lastName: event.target.value }))} required /></Field>
          </div>
          <Field label="Email"><input className="ui-control" type="email" autoComplete="email" value={createForm.email} onChange={(event) => setCreateForm((form) => ({ ...form, email: event.target.value }))} required /></Field>
          <Field label="Password" hint="Use at least eight characters."><input className="ui-control" type="password" autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm((form) => ({ ...form, password: event.target.value }))} required minLength={8} /></Field>
          <Button type="submit" loading={creating}>Create rider</Button>
        </form>
      </Sheet>

      <Sheet open={Boolean(onboardUser)} onOpenChange={(open) => { if (!open) setOnboardUser(null); }} title="Make driver" description={onboardUser ? `Set up driver access for ${displayName(onboardUser)}.` : undefined}>
        <form className="stack" onSubmit={(event) => void onboardDriver(event)}>
          <Field label="Vehicle registration"><input className="ui-control" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required /></Field>
          <Button type="submit" loading={Boolean(onboardUser && isActionPending(pendingActions, `onboard:${onboardUser.id}`))}>Make driver</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open) setConfirmAction(null); }} title={confirmAction?.title ?? "Confirm action"} description={confirmAction?.description ?? "This action changes account access."} confirmLabel={confirmAction?.confirmLabel ?? "Confirm"} onConfirm={async () => { await confirmAction?.run(); setConfirmAction(null); }} />
    </div>
  );
}
