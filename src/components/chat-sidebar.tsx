"use client";

/**
 * Sidebar riwayat percakapan (WP-NT-P4-02..P4-10, REQ-NT-32).
 *
 * Mengelompokkan chat per tanggal lokal pengguna, mendukung pencarian,
 * filter folder/arsip, dan aksi per item (ganti nama, pin, arsip, pindah
 * folder, bagikan, ekspor, hapus). Semua aksi memanggil endpoint yang sudah
 * ada lalu memuat ulang daftar — tanpa state global tambahan.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Download,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";
import { groupChats, type GroupableChat } from "@/lib/chat/grouping";
import type { MessageKey } from "@/lib/i18n/messages";

type Chat = GroupableChat;

type Folder = { id: string; name: string };

/** Label grup dari `groupChats()` masih bahasa Indonesia; terjemahkan saat render. */
const GROUP_LABEL: Record<string, MessageKey> = {
  Disematkan: "sidebar.group.pinned",
  "Hari ini": "sidebar.group.today",
  Kemarin: "sidebar.group.yesterday",
  "7 hari terakhir": "sidebar.group.last7",
  "Lebih lama": "sidebar.group.older",
};

export function ChatSidebar({
  activeChatId,
  onSelect,
}: {
  activeChatId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useT();
  const [chats, setChats] = useState<Chat[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Fokus dikembalikan ke tombol pemicu saat menu ditutup (UX-04).
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (query.trim()) params.set("q", query.trim());
    if (folderId) params.set("folderId", folderId);
    if (showArchived) params.set("archived", "true");
    if (cursor) params.set("cursor", cursor);

    try {
      const [chatRes, folderRes] = await Promise.all([
        fetch(`/api/kawan/v1/chats?${params}`),
        fetch("/api/kawan/v1/folders"),
      ]);
      if (chatRes.ok) {
        const data = (await chatRes.json()) as { chats?: Chat[]; nextCursor?: string | null };
        const page = data.chats ?? [];
        setChats((current) => (cursor ? [...current, ...page] : page));
        setNextCursor(data.nextCursor ?? null);
        setError(null);
      } else if (chatRes.status !== 401) {
        setError(t("sidebar.loadFailed"));
      }
      if (folderRes.ok) {
        const data = (await folderRes.json()) as { folders?: Folder[] };
        setFolders(data.folders ?? []);
      }
    } catch {
      setError(t("sidebar.loadFailed"));
    }
  }, [query, folderId, showArchived, t]);

  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  useEffect(() => {
    if (!menuId) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuId(null);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId]);

  async function patchChat(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/kawan/v1/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? t("sidebar.actionFailed"));
      return false;
    }
    setError(null);
    await load();
    return true;
  }

  async function removeChat(id: string) {
    if (!confirm(t("sidebar.deleteConfirm"))) return;
    const res = await fetch(`/api/kawan/v1/chats/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      setError(t("sidebar.deleteFailed"));
      return;
    }
    if (activeChatId === id) onSelect(null);
    await load();
  }

  async function shareChat(id: string) {
    const res = await fetch(`/api/kawan/v1/chats/${id}/shares`, { method: "POST" });
    if (!res.ok) {
      setError(t("sidebar.shareFailed"));
      return;
    }
    // Respons dibungkus `{ share: { token } }` (route `shares`), bukan token di akar.
    const data = (await res.json()) as { share?: { token?: string } };
    const token = data.share?.token;
    if (!token) {
      setError(t("sidebar.shareNoToken"));
      return;
    }
    const url = `${location.origin}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setError(t("sidebar.shareCopied", { url }));
    } catch {
      setError(t("sidebar.shareUrl", { url }));
    }
  }

  async function newFolder() {
    const name = prompt(t("sidebar.folderPrompt"));
    if (!name?.trim()) return;
    const res = await fetch("/api/kawan/v1/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? t("sidebar.folderFailed"));
      return;
    }
    await load();
  }

  const groups = useMemo(() => groupChats(chats), [chats]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mt-6 space-y-2">
        <label htmlFor="chat-search" className="sr-only">{t("sidebar.search")}</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="chat-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.search")}
            className="min-h-9 w-full rounded-lg border bg-background pl-8 pr-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={folderId === null ? "secondary" : "ghost"}
            size="xs"
            aria-pressed={folderId === null}
            onClick={() => setFolderId(null)}
          >
            {t("sidebar.all")}
          </Button>
          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant={folderId === folder.id ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={folderId === folder.id}
              onClick={() => setFolderId(folder.id)}
            >
              {folder.name}
            </Button>
          ))}
          <Button variant="ghost" size="icon-xs" aria-label={t("sidebar.newFolder")} title={t("sidebar.newFolder")} onClick={newFolder}>
            <FolderPlus aria-hidden />
          </Button>
          <Button
            variant={showArchived ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label={showArchived ? t("sidebar.hideArchived") : t("sidebar.showArchived")}
            title={showArchived ? t("sidebar.hideArchived") : t("sidebar.showArchived")}
            aria-pressed={showArchived}
            onClick={() => setShowArchived((value) => !value)}
          >
            <Archive aria-hidden />
          </Button>
        </div>
      </div>

      {error && (
        <p role="status" aria-live="polite" className="mt-3 rounded-md bg-muted px-2 py-1.5 text-xs break-words">
          {error}
        </p>
      )}

      <nav aria-label={t("sidebar.history")} className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {groups.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {query ? t("sidebar.noResults") : t("sidebar.noChats")}
          </p>
        )}
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="px-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              {GROUP_LABEL[group.label] ? t(GROUP_LABEL[group.label]) : group.label}
            </h2>
            <ul className="mt-1 space-y-0.5">
              {group.chats.map((chat) => (
                <li key={chat.id} className="relative">
                  {renaming?.id === chat.id ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const title = renaming.title.trim();
                        setRenaming(null);
                        if (title) await patchChat(chat.id, { title });
                      }}
                    >
                      <input
                        autoFocus
                        value={renaming.title}
                        onChange={(event) => setRenaming({ id: chat.id, title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setRenaming(null);
                        }}
                        aria-label={t("sidebar.newTitle")}
                        className="min-h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                      />
                      <Button type="submit" size="icon-xs" aria-label={t("sidebar.saveTitle")}>
                        <Check aria-hidden />
                      </Button>
                      <Button type="button" size="icon-xs" variant="ghost" aria-label={t("common.cancel")} onClick={() => setRenaming(null)}>
                        <X aria-hidden />
                      </Button>
                    </form>
                  ) : (
                    <div className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(chat.id)}
                        aria-current={activeChatId === chat.id ? "page" : undefined}
                        className="min-h-11 min-w-0 flex-1 truncate rounded-md px-2 text-left text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-medium"
                      >
                        {chat.pinned && <Pin aria-hidden className="mr-1 inline size-3 align-[-1px]" />}
                        {/* Judul bawaan dilabeli dari state, bukan dari nilai teks:
                            rename manual ke teks yang sama tetap tampil apa adanya. */}
                        {chat.titleSource === "auto" && (chat.titleRevision ?? 0) === 0
                          ? t("chat.newChatTitle")
                          : chat.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="min-h-11 min-w-11"
                        aria-label={t("sidebar.actionsFor", { title: chat.title })}
                        aria-expanded={menuId === chat.id}
                        onClick={(event) => {
                          menuTriggerRef.current = event.currentTarget;
                          setMenuId(menuId === chat.id ? null : chat.id);
                        }}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </div>
                  )}

                  {menuId === chat.id && (
                    <div ref={menuRef} className="absolute right-0 top-9 z-20 w-52 rounded-lg border bg-popover p-1 shadow-md">
                      <MenuItem icon={<Pencil aria-hidden />} onClick={() => { setRenaming({ id: chat.id, title: chat.title }); setMenuId(null); }}>
                        {t("sidebar.rename")}
                      </MenuItem>
                      <MenuItem icon={chat.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />} onClick={() => { setMenuId(null); void patchChat(chat.id, { pinned: !chat.pinned }); }}>
                        {chat.pinned ? t("sidebar.unpin") : t("sidebar.pin")}
                      </MenuItem>
                      <MenuItem icon={chat.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} onClick={() => { setMenuId(null); void patchChat(chat.id, { archived: !chat.archived }); }}>
                        {chat.archived ? t("sidebar.unarchive") : t("sidebar.archive")}
                      </MenuItem>
                      {folders.length > 0 && (
                        <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                          <FolderPlus aria-hidden className="size-4" />
                          <span className="sr-only">{t("sidebar.moveToFolder")}</span>
                          <select
                            value={chat.folderId ?? ""}
                            onChange={(event) => {
                              setMenuId(null);
                              void patchChat(chat.id, { folderId: event.target.value || null });
                            }}
                            className="min-h-7 min-w-0 flex-1 rounded border bg-background px-1 text-xs"
                          >
                            <option value="">{t("sidebar.noFolder")}</option>
                            {folders.map((folder) => (
                              <option key={folder.id} value={folder.id}>{folder.name}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <MenuItem icon={<Link2 aria-hidden />} onClick={() => { setMenuId(null); void shareChat(chat.id); }}>
                        {t("sidebar.shareLink")}
                      </MenuItem>
                      <a
                        href={`/api/kawan/v1/chats/${chat.id}/transfer?format=md`}
                        download
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => setMenuId(null)}
                      >
                        <Download aria-hidden className="size-4" />
                        {t("sidebar.exportMarkdown")}
                      </a>
                      <a
                        href={`/api/kawan/v1/chats/${chat.id}/transfer?format=pdf`}
                        download
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => setMenuId(null)}
                      >
                        <Download aria-hidden className="size-4" />
                        {t("sidebar.exportPdf")}
                      </a>
                      <a
                        href={`/api/kawan/v1/chats/${chat.id}/transfer?format=docx`}
                        download
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => setMenuId(null)}
                      >
                        <Download aria-hidden className="size-4" />
                        {t("sidebar.exportDocx")}
                      </a>
                      <a
                        href={`/api/kawan/v1/chats/${chat.id}/transfer?format=xlsx`}
                        download
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        onClick={() => setMenuId(null)}
                      >
                        <Download aria-hidden className="size-4" />
                        {t("sidebar.exportXlsx")}
                      </a>
                      <MenuItem icon={<Trash2 aria-hidden />} destructive onClick={() => { setMenuId(null); void removeChat(chat.id); }}>
                        {t("common.delete")}
                      </MenuItem>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {nextCursor && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => void load(nextCursor)}>
            {t("common.loadMore")}
          </Button>
        )}
      </nav>
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${destructive ? "text-destructive" : ""}`}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      {children}
    </button>
  );
}
