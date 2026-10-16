#!/usr/bin/env python3
"""Uji E2E mandor atas Kawan: daftar, masuk, rate limit, cabut sesi.

Bukan uji unit milik kuli. Semua permintaan dikirim ke server Kawan yang
benar-benar berjalan lewat HTTP, seperti pengguna sungguhan, sehingga yang
terbukti adalah perilaku aplikasi.

Tiga hal yang mudah salah dibaca, dan semuanya sudah diperhitungkan:

1. Auth.js SELALU menjawab 302 dari `/api/auth/callback/credentials` — saat
   kredensial ditolak, saat akun nonaktif, dan saat dibatasi rate limit.
   Kode status tidak bisa dipakai untuk membedakan; bukti yang sah adalah
   ada-tidaknya sesi setelah percobaan itu.
2. Akun non-pertama berstatus `pending` dan memang TIDAK bisa masuk
   (REQ-NT-11). Uji yang butuh akun aktif kedua harus mengaktifkannya dulu —
   mandor boleh menyiapkan fixture langsung di database.
3. `dev.db` dipakai bersama antar-jalan, sehingga akun pertama hanya benar-benar
   "pertama" pada database kosong. Skrip ini mengosongkan tabelnya lebih dulu;
   itu disengaja dan dicetak sebagai peringatan.

Pakai: python3 scripts/e2e_kawan.py [base_url]
"""
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3010"
PASSWORD = "KataSandi123!"
NEW_PASSWORD = "SandiBaru456!"
TABLES = ("Credential", "Session", "LoginAttempt", "Job", "User")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def resolve_db():
    """Berkas SQLite dari DATABASE_URL di .env, dengan bawaan ./dev.db."""
    url = ""
    env_file = os.path.join(ROOT, ".env")
    if os.path.exists(env_file):
        for line in open(env_file):
            if line.startswith("DATABASE_URL"):
                url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    url = url or "file:./dev.db"
    rel = url[len("file:"):] if url.startswith("file:") else url
    return rel if os.path.isabs(rel) else os.path.join(ROOT, rel)


DB = resolve_db()
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'✓' if ok else '✗'} {name}")
    if detail:
        print(f"      {detail}")
    return ok


def sql(query, params=()):
    """Koneksi terpisah: sekaligus bukti data ada di luar proses aplikasi."""
    con = sqlite3.connect(DB)
    try:
        rows = list(con.execute(query, params))
        con.commit()
        return rows
    finally:
        con.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Biarkan pengalihan terlihat; Auth.js memakai 302 untuk semua hasil."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    """Klien HTTP dengan cookie sendiri, meniru satu perangkat."""

    def __init__(self):
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar))
        self.raw = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)

    def request(self, method, path, data=None, json_body=False, follow=True):
        hdrs = {"User-Agent": "mandor-e2e/1.0"}
        body = None
        if data is not None:
            if json_body:
                body = json.dumps(data).encode()
                hdrs["Content-Type"] = "application/json"
            elif isinstance(data, dict):
                body = urllib.parse.urlencode(data).encode()
                hdrs["Content-Type"] = "application/x-www-form-urlencoded"
            else:
                body = data.encode()
        req = urllib.request.Request(BASE + path, data=body, headers=hdrs, method=method)
        opener = self.opener if follow else self.raw
        try:
            with opener.open(req, timeout=30) as resp:
                return resp.status, resp.read().decode("utf-8", "replace"), resp.headers
        except urllib.error.HTTPError as e:
            # Header dikembalikan APA ADANYA (Message), bukan dict(): dict()
            # membuang `Set-Cookie` karena dianggap duplikat, sehingga uji
            # atribut cookie akan selalu gagal walau cookienya benar.
            return e.code, e.read().decode("utf-8", "replace"), e.headers

    def json(self, method, path, data=None):
        code, text, _ = self.request(method, path, data, json_body=True)
        try:
            return code, json.loads(text)
        except ValueError:
            return code, None

    def csrf(self):
        _, data = self.json("GET", "/api/auth/csrf")
        return (data or {}).get("csrfToken")

    def login(self, email, password):
        """Satu percobaan login; kembalikan sesi atau None."""
        self.request(
            "POST", "/api/auth/callback/credentials",
            {"csrfToken": self.csrf(), "email": email, "password": password,
             "callbackUrl": BASE + "/"}, follow=False)
        _, data = self.json("GET", "/api/auth/session")
        return data


def register(email, password=PASSWORD, confirm=None):
    return Client().json("POST", "/api/register", {
        "email": email, "name": "Uji Mandor",
        "password": password, "confirmPassword": confirm or password,
    })


def main():
    stamp = int(time.time())
    admin = f"mandor{stamp}@contoh.id"
    victim = f"korban{stamp}@contoh.id"

    print("=" * 72)
    print(f"UJI E2E KAWAN — {BASE}")
    print(f"database: {DB}")
    print("PERINGATAN: tabel User/Credential/Session/LoginAttempt dikosongkan dulu")
    print("=" * 72)

    for table in TABLES:
        sql(f"delete from {table}")

    # ── 1. Halaman dasar ────────────────────────────────────────────────
    print("\n1. Halaman dasar")
    c = Client()
    for path in ("/", "/masuk", "/daftar"):
        code, _, _ = c.request("GET", path)
        check(f"GET {path} -> {code}", code == 200)
    _, html, _ = c.request("GET", "/masuk")
    check("branding tokengateway.ai.id tampil", "tokengateway.ai.id" in html)
    _, html, _ = c.request("GET", "/daftar")
    check("halaman daftar punya form", "<form" in html.lower())
    # `/pengaturan` dijaga di server. Next.js mengirim 200 dengan pengalihan di
    # sisi klien untuk halaman yang di-`redirect()`, jadi yang diperiksa adalah
    # hal yang benar-benar penting: isi terlindungi TIDAK ikut terkirim.
    _, html, _ = c.request("GET", "/pengaturan")
    check("/pengaturan tanpa sesi tidak mengirim isi terlindungi",
          "Kata sandi saat ini" not in html and "/masuk" in html,
          "formulir ganti sandi tidak ada; pengalihan ke /masuk disertakan")

    # ── 2. Pendaftaran ─────────────────────────────────────────────────
    print("\n2. Pendaftaran")
    code, body = register(admin)
    check(f"daftar akun pertama -> {code}", code in (200, 201), str(body)[:110])

    code, body = register(admin)
    check("email duplikat ditolak", code >= 400, f"{code} {str(body)[:90]}")

    code, body = register(f"pendek{stamp}@contoh.id", password="123")
    check("kata sandi terlalu pendek ditolak", code >= 400, f"{code} {str(body)[:90]}")

    code, body = register(f"beda{stamp}@contoh.id", confirm="BerbedaSekali1!")
    check("konfirmasi tidak cocok ditolak", code >= 400, f"{code} {str(body)[:90]}")

    row = sql("select role, status from User where email = ?", (admin,))
    check("akun pertama jadi admin dan aktif",
          bool(row) and row[0][0] == "admin" and row[0][1] == "active",
          f"role={row[0][0]} status={row[0][1]}" if row else "tidak ditemukan")

    # ── 3. Masuk ───────────────────────────────────────────────────────
    print("\n3. Masuk")
    device_a = Client()
    session_a = device_a.login(admin, PASSWORD)
    check("login berhasil dan sesi terbentuk", bool(session_a and session_a.get("user")),
          str(session_a)[:130])
    if session_a and session_a.get("user"):
        check("email di sesi sesuai", session_a["user"].get("email") == admin)

    device_b = Client()
    session_b = device_b.login(admin, PASSWORD)
    check("perangkat kedua bisa masuk", bool(session_b and session_b.get("user")))

    check("sandi salah tidak membuat sesi", Client().login(admin, "SandiSalah999!") is None)

    # ── 4. Rate limit (REQ-NT-15) ──────────────────────────────────────
    print("\n4. Rate limit login (REQ-NT-15)")
    register(victim)
    sql("update User set status = 'active' where email = ?", (victim,))
    sql("delete from LoginAttempt")
    limit = 5

    check("akun korban bisa masuk sebelum dibatasi",
          bool(Client().login(victim, PASSWORD)))
    # Login berhasil membuang hitungan, jadi mulai dari nol lagi.
    sql("delete from LoginAttempt")

    attacker = Client()
    for i in range(1, limit + 1):
        attacker.login(victim, f"Salah{i}!")

    rows = sql("select count(*) from LoginAttempt where key like ?", (victim + "%",))[0][0]
    check(f"{limit} percobaan gagal tercatat di tabel LoginAttempt", rows >= limit,
          f"{rows} baris (dibaca dari koneksi terpisah, jadi bukan memori proses)")

    check("setelah batas terlampaui, sandi BENAR pun ditolak",
          Client().login(victim, PASSWORD) is None,
          "Auth.js selalu 302; bukti diambil dari ada-tidaknya sesi")

    # Membuang hitungan meniru jendela waktu yang lewat; sekaligus membuktikan
    # data di tabel itulah yang membuka kunci, bukan keadaan di memori.
    sql("delete from LoginAttempt")
    check("setelah hitungan dibuang, pemilik bisa masuk lagi",
          bool(Client().login(victim, PASSWORD)))

    # ── 5. Ganti sandi mencabut sesi lain (REQ-NT-14) ──────────────────
    print("\n5. Ganti sandi mencabut sesi lain (REQ-NT-14)")
    sql("delete from LoginAttempt")
    a = Client()
    b = Client()
    check("perangkat A masuk", bool(a.login(admin, PASSWORD)))
    check("perangkat B masuk", bool(b.login(admin, PASSWORD)))
    check("keduanya punya sesi sebelum ganti sandi",
          bool(a.login(admin, PASSWORD) and b.login(admin, PASSWORD)))

    code, payload = a.json("POST", "/api/account/password", {
        "currentPassword": PASSWORD, "newPassword": NEW_PASSWORD,
        "confirmPassword": NEW_PASSWORD,
    })
    check(f"ganti sandi -> {code}", code == 200, str(payload)[:110])
    check("melaporkan sesi lain yang dicabut",
          bool(payload) and payload.get("revokedSessions", 0) >= 1,
          f"revokedSessions={payload.get('revokedSessions') if payload else '?'}")

    check("perangkat A tetap masuk (sesi sekarang dipertahankan)",
          a.json("GET", "/api/auth/session")[1] is not None)
    # Perangkat B diperiksa TANPA login ulang: memanggil login() akan membuat
    # sesi baru yang sah, sehingga pencabutan tidak akan pernah terlihat.
    check("perangkat B DICABUT", b.json("GET", "/api/auth/session")[1] is None)

    sql("delete from LoginAttempt")
    check("sandi lama sudah tidak berlaku", Client().login(admin, PASSWORD) is None)
    check("sandi baru bisa dipakai", bool(Client().login(admin, NEW_PASSWORD)))

    code, payload = Client().json("POST", "/api/account/password", {
        "currentPassword": NEW_PASSWORD, "newPassword": NEW_PASSWORD,
        "confirmPassword": NEW_PASSWORD,
    })
    check("ganti sandi tanpa sesi ditolak (401)", code == 401, f"{code} {str(payload)[:70]}")

    # ── 6. Atribut cookie sesi ─────────────────────────────────────────
    print("\n6. Atribut cookie sesi")
    probe = Client()
    _, _, hdrs = probe.request(
        "POST", "/api/auth/callback/credentials",
        {"csrfToken": probe.csrf(), "email": admin, "password": NEW_PASSWORD,
         "callbackUrl": BASE + "/"}, follow=False)
    raw_cookies = hdrs.get_all("Set-Cookie") or []
    session_cookie = next((c for c in raw_cookies if "session-token" in c), "")
    check("cookie sesi dipasang saat login", bool(session_cookie),
          (session_cookie[:90] + "…") if session_cookie else "(tidak ada Set-Cookie)")
    check("cookie sesi HttpOnly", "HttpOnly" in session_cookie, session_cookie[:150])
    check("cookie sesi SameSite", "SameSite" in session_cookie,
          ", ".join(p.strip() for p in session_cookie.split(";") if "SameSite" in p))

    # Diperiksa juga dari cookie jar: bukti independen bahwa peramban menerima
    # atribut HttpOnly, bukan hanya bahwa headernya dikirim.
    jar_flags = [(ck.name, ck.has_nonstandard_attr("HttpOnly")) for ck in probe.jar
                 if "session-token" in ck.name]
    check("cookie jar menandai sesi sebagai HttpOnly",
          bool(jar_flags) and all(flag for _, flag in jar_flags), str(jar_flags))

    # ── Ringkasan ──────────────────────────────────────────────────────
    print("\n" + "=" * 72)
    ok = sum(1 for _, o, _ in results if o)
    print(f"HASIL: {ok}/{len(results)} lulus")
    for name, o, _ in results:
        if not o:
            print(f"  GAGAL: {name}")
    print("=" * 72)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
