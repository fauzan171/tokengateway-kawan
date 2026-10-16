/**
 * Reducer pohon pesan (WP-NT-P3-02, SDD-2.4).
 *
 * Fungsi murni atas daftar pesan: tidak menyentuh database, cukup terima array
 * lalu kembalikan nilai. Rantai yang rusak (siklus atau `parentId` menggantung)
 * ditolak dengan galat jelas, bukan diam-diam dianggap root, supaya pemanggil
 * tidak menyusun konteks dari pohon yang cacat.
 */

export type TreeNode = {
  id: string;
  chatId: string;
  parentId: string | null;
  role: string;
  seq: number;
  status: string;
  contentJson: string;
};

const bySeq = (a: TreeNode, b: TreeNode) => a.seq - b.seq;

function index(messages: readonly TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  for (const m of messages) map.set(m.id, m);
  return map;
}

/**
 * Jalur root → leaf, urut. Ini yang dikirim ke gateway sebagai konteks.
 * `leafId` null atau tidak ada → `[]`. Siklus atau `parentId` menggantung → galat.
 */
export function buildAncestryPath(
  messages: readonly TreeNode[],
  leafId: string | null,
): TreeNode[] {
  const byId = index(messages);
  const path: TreeNode[] = [];
  const seen = new Set<string>();

  let current = leafId === null ? undefined : byId.get(leafId);
  while (current) {
    if (seen.has(current.id)) {
      throw new Error(`Siklus pohon pesan terdeteksi pada "${current.id}"`);
    }
    seen.add(current.id);
    path.push(current);

    if (current.parentId === null) break;
    const parent = byId.get(current.parentId);
    if (!parent) {
      throw new Error(
        `parentId "${current.parentId}" dari pesan "${current.id}" tidak ditemukan`,
      );
    }
    current = parent;
  }

  return path.reverse();
}

/** Semua pesan dengan `parentId` sama, urut `seq`. `messageId` tak ada → `[]`. */
export function siblingsOf(
  messages: readonly TreeNode[],
  messageId: string,
): TreeNode[] {
  const node = messages.find((m) => m.id === messageId);
  if (!node) return [];
  return messages.filter((m) => m.parentId === node.parentId).sort(bySeq);
}

/** Leaf aktif; null bila `currentMessageId` null atau menunjuk pesan yang tak ada. */
export function activeLeaf(
  messages: readonly TreeNode[],
  currentMessageId: string | null,
): string | null {
  if (currentMessageId === null) return null;
  return messages.some((m) => m.id === currentMessageId) ? currentMessageId : null;
}

/** Semua keturunan `rootId` (tanpa root), urut `seq`. Root tak ada → `[]`. */
export function subtreeOf(
  messages: readonly TreeNode[],
  rootId: string,
): TreeNode[] {
  const byId = index(messages);
  if (!byId.has(rootId)) return [];

  const out: TreeNode[] = [];
  const seen = new Set<string>([rootId]);
  const stack: string[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined) break;
    for (const child of messages) {
      if (child.parentId === id && !seen.has(child.id)) {
        seen.add(child.id);
        out.push(child);
        stack.push(child.id);
      }
    }
  }
  return out.sort(bySeq);
}

/** `seq` berikutnya untuk chat itu. Kosong → 1. */
export function nextSeq(messages: readonly TreeNode[], chatId: string): number {
  let max = 0;
  for (const m of messages) {
    if (m.chatId === chatId && m.seq > max) max = m.seq;
  }
  return max + 1;
}
