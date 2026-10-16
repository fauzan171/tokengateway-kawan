#!/usr/bin/env python3
"""Gate NT-P2: onboarding, koneksi, model — dijalankan mandor terhadap server hidup.

Yang dibuktikan di sini adalah tiga hal yang diminta gate NT-P2 di `plan.md`:

1. Alur onboarding berjalan end-to-end (daftar → masuk → uji koneksi → simpan → model).
2. **API Key tidak pernah kembali ke browser** — diuji dengan CANARY: sebuah string
   penanda unik dipakai sebagai API key, lalu SELURUH respons diperiksa; penanda itu
   tidak boleh muncul di mana pun, dalam bentuk apa pun.
3. Hanya satu koneksi aktif pada satu waktu.

Bukan uji unit milik worker. Semua permintaan lewat HTTP ke server yang benar-benar
berjalan, seperti pengguna sungguhan.

Pakai:
    python3 scripts/e2e_nt_p2.py [base_url] [gateway_url] [gateway_key]

Bawaan base_url `http://127.0.0.1:3010`, gateway `http://127.0.0.1:20128/v1`.

CATATAN: agar uji koneksi bisa menyentuh gateway lokal, instance Kawan yang diuji
harus dijalankan dengan `ALLOW_INSECURE_HTTP=true` dan
`OUTBOUND_ALLOWLIST=127.0.0.1:20128`. Tanpa itu, kebijakan SSRF menolaknya — dan
itu perilaku yang benar, bukan kegagalan.
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
GATEWAY = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:20128/v1"
GATEWAY_KEY = sys.argv[3] if len(sys.argv) > 3 else "sk-9router-lokal"

PASSWORD = "KataSandi123!"
# Penanda unik dipakai sebagai API key. Bagian PEMBEDA sengaja diletakkan di
# TENGAH: mask resmi memang menampilkan awalan + 4 karakter akhir (SDD-5.2,
# `sk-...abc1`), jadi penanda di ujung akan ikut terlihat oleh desain dan
# melemahkan uji. Yang diuji adalah bahwa isi tengah tidak pernah bocor.
CANARY = "sk-CANARY-TENGAH-9f3a2b7c-XYZ1"
CANARY_TAG = "CANARY-TENGAH-9f3a2b7c"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLES = ("Connection", "ModelCache", "Credential", "Session", "LoginAttempt", "User")

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'✓' if ok else '✗'} {name}")
    if detail:
        print(f"      {detail}")
    return ok


def resolve_db():
    """Berkas SQLite yang sedang dipakai server UJI.

    `DATABASE_URL` dari environment diutamakan: gate sering dijalankan terhadap
    instance terpisah dengan database sendiri, dan membaca `.env` repo akan
    memeriksa database yang SALAH — pemeriksaan lolos/gagal tanpa hubungan
    dengan server yang diuji.
    """
    url = (os.environ.get("DATABASE_URL") or "").strip()
    if not url:
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


def sql(query, params=()):
    con = sqlite3.connect(DB)
    try:
        rows = list(con.execute(query, params))
        con.commit()
        return rows
    finally:
        con.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self):
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar))
        self.raw = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)

    def request(self, method, path, data=None, json_body=False, follow=True):
        hdrs = {"User-Agent": "mandor-gate/1.0"}
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
            with opener.open(req, timeout=60) as resp:
                return resp.status, resp.read().decode("utf-8", "replace"), resp.headers
        except urllib.error.HTTPError as e:
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
        self.request("POST", "/api/auth/callback/credentials",
                     {"csrfToken": self.csrf(), "email": email, "password": password,
                      "callbackUrl": BASE + "/"}, follow=False)
        _, data = self.json("GET", "/api/auth/session")
        return data

    def session(self):
        _, data = self.json("GET", "/api/auth/session")
        return data


def register(email):
    return Client().json("POST", "/api/register", {
        "email": email, "name": "Uji NT-P2", "password": PASSWORD,
        "confirmPassword": PASSWORD})


def main():
    stamp = int(time.time())
    admin = f"gate{stamp}@contoh.id"

    print("=" * 74)
    print(f"GATE NT-P2 — {BASE}")
    print(f"gateway: {GATEWAY}")
    print("PERINGATAN: tabel koneksi/user/sesi dikosongkan lebih dulu")
    print("=" * 74)

    for table in TABLES:
        sql(f"delete from {table}")

    # ── 1. Onboarding E2E ──────────────────────────────────────────────
    print("\n1. Onboarding end-to-end")
    c = Client()
    code, _, _ = c.request("GET", "/")
    check("halaman depan hidup", code == 200, f"{code}")

    code, body = register(admin)
    check(f"daftar akun pertama -> {code}", code in (200, 201), str(body)[:90])

    session = c.login(admin, PASSWORD)
    check("masuk dan sesi terbentuk", bool(session and session.get("user")))

    # ── 2. Uji koneksi (tanpa menyimpan) ───────────────────────────────
    print("\n2. Uji koneksi tanpa menyimpan (POST /connections/test)")
    code, body = c.json("POST", "/api/kawan/v1/connections/test",
                        {"baseUrl": GATEWAY, "apiKey": GATEWAY_KEY})
    check("uji koneksi dibalas 200 (hasil uji, bukan galat request)",
          code == 200, f"{code} {str(body)[:130]}")
    if isinstance(body, dict) and body.get("ok"):
        check("jumlah model terlaporkan", isinstance(body.get("modelCount"), int),
              f"modelCount={body.get('modelCount')} sample={body.get('sampleModels')}")
    else:
        check("uji koneksi berhasil", False,
              f"ok={body.get('ok') if isinstance(body, dict) else '?'} "
              f"reason={body.get('reason') if isinstance(body, dict) else '?'} "
              f"message={body.get('message') if isinstance(body, dict) else '?'}")

    # ── 3. Simpan koneksi + CANARY ─────────────────────────────────────
    print("\n3. Simpan koneksi — uji canary (key tidak boleh kembali)")
    code, created = c.json("POST", "/api/kawan/v1/connections",
                           {"name": "Gateway Uji", "baseUrl": GATEWAY,
                            "apiKey": CANARY, "skipTest": False})
    check(f"simpan koneksi -> {code}", code in (200, 201), str(created)[:130])

    blob = json.dumps(created, ensure_ascii=False)
    check("CANARY tidak ada di respons pembuatan", CANARY not in blob and CANARY_TAG not in blob,
          "penanda ditemukan di respons!" if CANARY in blob else "bersih")
    check("respons memuat mask, bukan key",
          bool(isinstance(created, dict) and created.get("apiKeyMask")),
          f"apiKeyMask={created.get('apiKeyMask') if isinstance(created, dict) else '?'}")

    # canary juga tidak boleh ada di DAFTAR dan di database
    code, listed = c.json("GET", "/api/kawan/v1/connections")
    list_blob = json.dumps(listed, ensure_ascii=False)
    check("CANARY tidak ada di respons daftar", CANARY not in list_blob,
          "penanda ditemukan di daftar!" if CANARY in list_blob else "bersih")
    check("daftar tidak memuat ciphertext",
          "apiKeyEncrypted" not in list_blob and "v1:" not in list_blob)

    rows = sql("select apiKeyEncrypted, apiKeyMask from Connection")
    check("database menyimpan ciphertext, bukan key mentah",
          bool(rows) and CANARY not in (rows[0][0] or ""),
          f"tersimpan: {(rows[0][0] or '')[:40]}… mask={rows[0][1]}")

    # ── 4. Hanya satu koneksi aktif ────────────────────────────────────
    print("\n4. Hanya satu koneksi aktif (REQ-NT-10)")
    code, second = c.json("POST", "/api/kawan/v1/connections",
                          {"name": "Gateway Kedua", "baseUrl": GATEWAY,
                           "apiKey": GATEWAY_KEY, "skipTest": True})
    check(f"tambah koneksi kedua -> {code}", code in (200, 201), str(second)[:110])
    check("koneksi kedua berstatus draft (skipTest)", 
          isinstance(second, dict) and second.get("status") == "draft",
          f"status={second.get('status') if isinstance(second, dict) else '?'}")

    active = sql("select count(*) from Connection where isActive = 1")[0][0]
    check("tetap tepat SATU koneksi aktif", active == 1, f"aktif={active}")

    second_id = second.get("id") if isinstance(second, dict) else None
    if second_id:
        code, _ = c.json("POST", f"/api/kawan/v1/connections/{second_id}/activate", {})
        active = sql("select count(*) from Connection where isActive = 1")[0][0]
        check("mengaktifkan koneksi lain menonaktifkan yang lama",
              code < 400 and active == 1, f"http={code} aktif={active}")

    # ── 5. Daftar model dari koneksi aktif ─────────────────────────────
    print("\n5. Daftar model (GET /models)")
    code, models = c.json("GET", "/api/kawan/v1/models")
    check(f"daftar model -> {code}", code == 200, str(models)[:130])
    if isinstance(models, dict) and models.get("models"):
        n = len(models["models"])
        caps = [m.get("capabilities") for m in models["models"]]
        check(f"{n} model terbaca", n > 0)
        check("capabilities tidak diisi false palsu",
              all(c is None or all(v is True for v in c.values()) for c in caps),
              f"contoh: {caps[:3]}")
        check("tidak semua model punya capabilities identik (bukti tidak menebak)",
              len({json.dumps(c, sort_keys=True) for c in caps}) > 1 or all(c is None for c in caps),
              f"varian: {len({json.dumps(c, sort_keys=True) for c in caps})}")
    else:
        check("daftar model berisi", False, str(models)[:160])

    # ── Ringkasan ──────────────────────────────────────────────────────
    print("\n" + "=" * 74)
    ok = sum(1 for _, o, _ in results if o)
    print(f"HASIL: {ok}/{len(results)} lulus")
    for name, o, _ in results:
        if not o:
            print(f"  GAGAL: {name}")
    print("=" * 74)
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
