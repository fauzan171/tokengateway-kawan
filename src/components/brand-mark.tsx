// Logo resmi tokengateway.ai.id, dipakai sebagai tanda Kawan.
// PNG 512px transparan; ukuran diatur lewat className.
export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- aset merek statis, bukan kandidat optimasi
    <img src="/brand/tokengateway.png" alt="" width={512} height={512} className={className} />
  );
}
