/**
 * Daftar sumber web pada jawaban assistant (WP-NT-P7-02, REQ-NT-52).
 *
 * Tautan selalu tab baru + `noopener noreferrer`: URL berasal dari mesin
 * pencari luar, jadi tab tujuan tidak boleh bisa mengakses `window.opener`.
 */

export function SourceList({ sources }: { sources: { title: string; url: string }[] }) {
  if (sources.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-col gap-0.5 px-1 text-xs text-muted-foreground">
      {sources.map((source) => (
        <li key={source.url}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            {source.title || source.url}
          </a>
        </li>
      ))}
    </ul>
  );
}
