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

const OPTIONAL_LABELS: Record<keyof Status["optional"], string> = {
  webSearch: "Pencarian web",
  imageGen: "Pembuatan gambar",
  stt: "Transkripsi suara",
  tts: "Suara balasan",
  embedding: "Embedding dokumen",
};

function tanggal(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("id-ID");
}

async function jsonOf<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(body?.error?.message ?? "Permintaan gagal.");
  return body;
}

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [userRes, configRes, statusRes] = await Promise.all([
        fetch("/api/kawan/v1/admin/users"),
        fetch("/api/kawan/v1/admin/config"),
        fetch("/api/kawan/v1/admin/status"),
      ]);
      const userBody = await jsonOf<{ users: AdminUser[]; nextCursor: string | null }>(userRes);
      const configBody = await jsonOf<{ config: { registrationOpen: boolean } }>(configRes);
      const statusBody = await jsonOf<Status>(statusRes);
      setUsers(userBody.users);
      setNextCursor(userBody.nextCursor);
      setOpen(configBody.config.registrationOpen);
      setStatus(statusBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat panel admin.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "active" ? "disabled" : "active";
    if (next === "disabled" && !confirm(`Nonaktifkan ${user.email}? Semua sesinya akan dicabut.`)) return;
    setError(null);
    try {
      await jsonOf(
        await fetch(`/api/kawan/v1/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        }),
      );
      setUsers((current) => current?.map((item) => (item.id === user.id ? { ...item, status: next } : item)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status.");
    }
  }

  async function remove(user: AdminUser) {
    if (!confirm(`Hapus ${user.email} beserta seluruh data pribadinya? Tindakan ini tidak dapat dibatalkan.`)) return;
    setError(null);
    try {
      await jsonOf(await fetch(`/api/kawan/v1/admin/users/${user.id}`, { method: "DELETE" }));
      setUsers((current) => current?.filter((item) => item.id !== user.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pengguna.");
    }
  }

  async function toggleRegistration() {
    if (open === null) return;
    setError(null);
    try {
      const body = await jsonOf<{ config: { registrationOpen: boolean } }>(
        await fetch("/api/kawan/v1/admin/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationOpen: !open }),
        }),
      );
      setOpen(body.config.registrationOpen);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi.");
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
        <h2 id="pendaftaran" className="text-lg font-semibold">Pendaftaran publik</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saat ditutup, pendaftar baru ditolak dan halaman daftar menjelaskan bahwa akun dibuat administrator.
        </p>
        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={open ?? false}
            disabled={open === null}
            onChange={() => void toggleRegistration()}
          />
          <span className="text-sm font-medium">Buka pendaftaran publik</span>
        </label>
      </section>

      <section aria-labelledby="pengguna">
        <h2 id="pengguna" className="text-lg font-semibold">Pengguna</h2>
        {users === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Memuat…</p>
        ) : users.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada pengguna.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Daftar pengguna dan tindakannya</caption>
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Email</th>
                  <th scope="col" className="px-3 py-2 font-medium">Nama</th>
                  <th scope="col" className="px-3 py-2 font-medium">Peran</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Terdaftar</th>
                  <th scope="col" className="px-3 py-2 font-medium">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-3 py-2">{user.email}</td>
                    <td className="px-3 py-2">{user.name ?? "—"}</td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.status === "active" ? "aktif" : user.status}</td>
                    <td className="px-3 py-2">{tanggal(user.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => void toggleStatus(user)}>
                          {user.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button variant="destructive" onClick={() => void remove(user)}>Hapus</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {nextCursor ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Menampilkan {users?.length ?? 0} pengguna pertama; sisanya belum dimuat.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="status">
        <h2 id="status" className="text-lg font-semibold">Status sistem</h2>
        {status === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <dl className="rounded-xl border p-4 text-sm">
              <dt className="text-muted-foreground">Versi</dt>
              <dd className="font-medium">{status.version}</dd>
              <dt className="mt-3 text-muted-foreground">Database</dt>
              <dd className="font-medium">{status.database.ok ? "terhubung" : "tidak dapat dihubungi"}</dd>
              <dt className="mt-3 text-muted-foreground">Job tertunda / gagal</dt>
              <dd className="font-medium">{status.worker.pendingJobs} / {status.worker.failedJobs}</dd>
              <dt className="mt-3 text-muted-foreground">Detak worker terakhir</dt>
              <dd className="font-medium">
                {status.worker.lastHeartbeat ? new Date(status.worker.lastHeartbeat).toLocaleString("id-ID") : "belum ada"}
              </dd>
              <dt className="mt-3 text-muted-foreground">Pengguna / chat / dokumen</dt>
              <dd className="font-medium">
                {status.counts.users} / {status.counts.chats} / {status.counts.documents}
              </dd>
            </dl>
            <div className="rounded-xl border p-4 text-sm">
              <p className="text-muted-foreground">Komponen opsional</p>
              <ul className="mt-2 space-y-1">
                {(Object.keys(OPTIONAL_LABELS) as (keyof Status["optional"])[]).map((key) => (
                  <li key={key} className="flex justify-between gap-3">
                    <span>{OPTIONAL_LABELS[key]}</span>
                    <span className="font-medium">{status.optional[key] ? "aktif" : "tidak dikonfigurasi"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Komponen yang tidak dikonfigurasi tidak memblokir aplikasi.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
