/**
 * Pengelompokan riwayat percakapan per tanggal lokal pengguna (WP-NT-P4-02).
 *
 * Dipisah dari komponen agar bisa diuji tanpa DOM: hanya menerima daftar chat
 * dan satu acuan waktu.
 */

export type GroupableChat = {
  id: string;
  title: string;
  folderId: string | null;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
};

export type ChatGroup<T extends GroupableChat = GroupableChat> = {
  label: string;
  chats: T[];
};

const DAY = 86_400_000;

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function groupChats<T extends GroupableChat>(
  chats: readonly T[],
  now: Date = new Date(),
): ChatGroup<T>[] {
  const today = startOfDay(now);
  const buckets: ChatGroup<T>[] = [
    { label: "Disematkan", chats: [] },
    { label: "Hari ini", chats: [] },
    { label: "Kemarin", chats: [] },
    { label: "7 hari terakhir", chats: [] },
    { label: "Lebih lama", chats: [] },
  ];

  for (const chat of chats) {
    if (chat.pinned) {
      buckets[0]!.chats.push(chat);
      continue;
    }
    const day = startOfDay(new Date(chat.updatedAt));
    if (day >= today) buckets[1]!.chats.push(chat);
    else if (day >= today - DAY) buckets[2]!.chats.push(chat);
    else if (day >= today - 7 * DAY) buckets[3]!.chats.push(chat);
    else buckets[4]!.chats.push(chat);
  }

  return buckets.filter((bucket) => bucket.chats.length > 0);
}
