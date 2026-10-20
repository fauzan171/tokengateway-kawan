// Tanda Kawan (knot monoline). Hitam pekat + alpha; dibalik otomatis di tema gelap.
export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- aset merek statis, bukan kandidat optimasi
    <img src="/brand/kawan-mark.png" alt="" width={512} height={439} className={`${className} dark:invert`} />
  );
}

// Atribusi "by tokengateway.ai.id".
export function GatewayMark({ className = "size-4" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- aset merek statis
    <img src="/brand/tokengateway.png" alt="" width={512} height={512} className={className} />
  );
}
