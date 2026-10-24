"use client";

/**
 * Panel admin (REQ-NT-74/75/76/77).
 *
 * Satu komponen memuat tiga sumber sekaligus: daftar pengguna, sakelar
 * pendaftaran, dan status sistem. Setiap kegagalan ditampilkan sebagai teks
 * kecil di dekat bagiannya, bukan `alert`, supaya satu bagian yang gagal
 * tidak menutupi bagian lain.
 *
 * Komponen opsional yang tidak dikonfigurasi hanya diberi label "tidak
 * dikonfigurasi" — itu keadaan normal, bukan galat (SDD-8.5).
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT, type Translate } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
};

type Status = {
  version: string;
  database: { ok: boolean };
  worker: { lastHeartbeat: string | null; pendingJobs: number; failedJobs: number };
  counts: { users: number; chats: number; documents: number };
  optional: { webSearch: boolean; imageGen: boolean; stt: boolean; tts: boolean; embedding: boolean };
};

const OPTIONAL_LABELS: Record<keyof Status["optional"], MessageKey> = {
  webSearch: "admin.optional.webSearch",
  imageGen: "admin.optional.imageGen",
  stt: "admin.optional.stt",
  tts: "admin.optional.tts",
  embedding: "admin.optional.embedding",
};

function tanggal(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("id-ID");
}

async function jsonOf<T>(t: Translate, response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(body?.error?.message ?? t("admin.requestFailed"));
  return body;
}

export function AdminPanel() {
  const t = useT();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [userRes, configRes, statusRes] = await Promise.all([
        fetch("/api/kawan/v1/admin/users"),
        fetch("/api/kawan/v1/admin/config"),
        fetch("/api/kawan/v1/admin/status"),
      ]);
      const userBody = await jsonOf<{ users: AdminUser[]; nextCursor: string | null }>(t, userRes);
      const configBody = await jsonOf<{ config: { registrationOpen: boolean } }>(t, configRes);
      const statusBody = await jsonOf<Status>(t, statusRes);
      setUsers(userBody.users);
      setNextCursor(userBody.nextCursor);
      setOpen(configBody.config.registrationOpen);
      setStatus(statusBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Memuat halaman berikut; id yang sudah ada dilewati agar tidak ganda. */
  async function loadMore() {
    if (!nextCursor) return;
    setError(null);
    setLoadingMore(true);
    try {
      const body = await jsonOf<{ users: AdminUser[]; nextCursor: string | null }>(
        t,
        await fetch(`/api/kawan/v1/admin/users?cursor=${encodeURIComponent(nextCursor)}`),
      );
      setUsers((current) => {
        const known = new Set((current ?? []).map((user) => user.id));
        return [...(current ?? []), ...body.users.filter((user) => !known.has(user.id))];
      });
      setNextCursor(body.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.loadMoreFailed"));
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "active" ? "disabled" : "active";
    if (next === "disabled" && !confirm(t("admin.disableConfirm", { email: user.email }))) return;
    setError(null);
    try {
      await jsonOf(
        t,
        await fetch(`/api/kawan/v1/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }),
      );
      setUsers((current) => current?.map((item) => (item.id === user.id ? { ...item, status: next } : item)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.statusFailed"));
    }
  }

  async function remove(user: AdminUser) {
    if (!confirm(t("admin.deleteConfirm", { email: user.email }))) return;
    setError(null);
    try {
      await jsonOf(t, await fetch(`/api/kawan/v1/admin/users/${user.id}`, { method: "DELETE" }));
      setUsers((current) => current?.filter((item) => item.id !== user.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.deleteFailed"));
    }
  }

  async function toggleRegistration() {
    if (open === null) return;
    setError(null);
    try {
      const body = await jsonOf<{ config: { registrationOpen: boolean } }>(
        t,
        await fetch("/api/kawan/v1/admin/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationOpen: !open }),
        }),
      );
      setOpen(body.config.registrationOpen);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.configFailed"));
    }
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="pendaftaran">
        <h2 id="pendaftaran" className="text-lg font-semibold">{t("admin.registrationTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.registrationBody")}
        </p>
        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={open ?? false}
            disabled={open === null}
            onChange={() => void toggleRegistration()}
          />
          <span className="text-sm font-medium">{t("admin.registrationOpen")}</span>
        </label>
      </section>

      <section aria-labelledby="pengguna">
        <h2 id="pengguna" className="text-lg font-semibold">{t("admin.usersTitle")}</h2>
        {users === null ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : users.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("admin.noUsers")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">{t("admin.usersCaption")}</caption>
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colEmail")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colName")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colRole")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colStatus")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colRegistered")}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.name ?? "—"}</td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.status === "active" ? t("admin.active") : user.status}</td>
                    <td className="px-3 py-2">{tanggal(user.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button variant="outline" className="min-h-11" onClick={() => void toggleStatus(user)}>
                          {user.status === "active" ? t("admin.disable") : t("admin.enable")}
                        </Button>
                        <Button variant="destructive" className="min-h-11" onClick={() => void remove(user)}>{t("common.delete")}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor ? (
          <div className="mt-3 flex items-center gap-3">
            <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? t("common.loading") : t("common.loadMore")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("admin.showing", { count: users?.length ?? 0 })}
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="status">
        <h2 id="status" className="text-lg font-semibold">{t("admin.systemTitle")}</h2>
        {status === null ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <dl className="rounded-xl border p-4 text-sm">
              <dt className="text-muted-foreground">{t("admin.version")}</dt>
              <dd className="font-medium">{status.version}</dd>
              <dt className="mt-3 text-muted-foreground">{t("admin.database")}</dt>
              <dd className="font-medium">{status.database.ok ? t("admin.connected") : t("admin.unreachable")}</dd>
              <dt className="mt-3 text-muted-foreground">{t("admin.jobs")}</dt>
              <dd className="font-medium">{status.worker.pendingJobs} / {status.worker.failedJobs}</dd>
              <dt className="mt-3 text-muted-foreground">{t("admin.heartbeat")}</dt>
              <dd className="font-medium">
                {status.worker.lastHeartbeat ? new Date(status.worker.lastHeartbeat).toLocaleString("id-ID") : t("admin.none")}
              </dd>
              <dt className="mt-3 text-muted-foreground">{t("admin.counts")}</dt>
              <dd className="font-medium">
                {status.counts.users} / {status.counts.chats} / {status.counts.documents}
              </dd>
            </dl>
            <div className="rounded-xl border p-4 text-sm">
              <p className="text-muted-foreground">{t("admin.optionalTitle")}</p>
              <ul className="mt-2 space-y-1">
                {(Object.keys(OPTIONAL_LABELS) as (keyof Status["optional"])[]).map((key) => (
                  <li key={key} className="flex justify-between gap-3">
                    <span>{t(OPTIONAL_LABELS[key])}</span>
                    <span className="font-medium">{status.optional[key] ? t("admin.configured") : t("admin.notConfigured")}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("admin.optionalNote")}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
