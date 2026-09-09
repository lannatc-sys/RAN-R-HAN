# DEPLOY — หน้าบ้านขึ้น Vercel, หลังบ้านใช้ Supabase

สถาปัตยกรรม: โปรเจกต์นี้เป็น **monorepo เดียว** (`lannatc-sys/RAN-R-HAN`)

- **หน้าบ้าน (Frontend):** Next.js App Router — deploy บน **Vercel** จาก branch `main`
- **หลังบ้าน (Backend):** **Supabase** (Postgres + Auth + RLS) — รันอยู่แล้ว ไม่ต้อง deploy ใหม่
- หน้าบ้านคุยกับหลังบ้านผ่าน Supabase client (`src/lib/supabase/`) + API routes (`src/app/api/`)

## 1. GitHub (ต้นทางของ Vercel)

```bash
git push origin main
```

Vercel จะ auto-deploy ทุกครั้งที่ push ลง `main`

## 2. Supabase — ตรวจว่าพร้อม (ทำครั้งเดียว)

1. เปิด Supabase Dashboard → โปรเจกต์ `hqfzahyvwsjrvlgvaxda`
2. ตรวจ Table Editor ว่ามีตาราง `shops`, `users`, `categories`, `menu_items`, `orders`, `payments` ครบ
3. ถ้าเพิ่งสร้างโปรเจกต์ใหม่: รัน `supabase/migrations/run_all.sql` แล้วตามด้วย
   `supabase/migrations/20260906000001_pickup_mvp.sql` ใน SQL Editor
   (หรือรันจากเครื่อง: `node scripts/run-db.js`)

## 3. Vercel — เชื่อม GitHub (ทำครั้งเดียว)

1. เข้า [vercel.com](https://vercel.com) → Add New → Project → Import `lannatc-sys/RAN-R-HAN`
2. Framework Preset: **Next.js** (Vercel อ่าน `vercel.json` ให้เอง: `pnpm install` + `pnpm build`, region `sin1` สิงคโปร์)
3. ใส่ Environment Variables **ทุกตัว** (copy ค่าจาก `.env.local` ในเครื่อง — **ห้าม generate ค่าใหม่** ไม่งั้นถอดรหัสข้อมูลร้านเดิมไม่ได้):

| Variable | มาจากไหน |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → Data API → URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → `publishable`/`anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → `secret` (**ห้ามขึ้นต้นด้วย NEXT_PUBLIC_**) |
| `DATABASE_URL` | Supabase → Connect → Pooler (IPv4, port 5432) — ใช้ตอน migrate อย่างเดียว |
| `CREDENTIALS_ENCRYPTION_KEY` | copy จาก `.env.local` ตรงๆ |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | copy จาก `.env.local` ตรงๆ |
| `SLIPOK_WEBHOOK_SECRET` | copy จาก `.env.local` ตรงๆ |
| `SUPER_ADMIN_USER` | อีเมลแอดมิน เช่น `lannatc@gmail.com` |
| `GOOGLE_Client_ID` / `GOOGLE_Client_secret` | Google Cloud Console (ถ้าใช้ login ด้วย Google) |

4. กด Deploy → ได้โดเมน `https://<project>.vercel.app`

## 4. หลัง deploy — ตั้งค่า webhook ให้ชี้กลับมาที่ Vercel

- เอา URL `https://<project>.vercel.app/api/webhooks/slipok` + ค่า `SLIPOK_WEBHOOK_SECRET`
  ไปตั้งใน dashboard ของ SlipOK/OkSlip ของร้าน
- ตรวจ Supabase → Authentication → URL Configuration: ใส่ Vercel domain ใน **Redirect URLs**

## 5. ตรวจหลังขึ้น production

- [ ] เปิดหน้าแรก + หน้าเมนูร้าน (`/<slug>`) ได้
- [ ] สั่งออเดอร์แบบจ่ายเงินสด → ขึ้นใน KDS (`/admin/orders`)
- [ ] สั่งแบบ PromptPay → QR แสดงยอดถูกต้อง
- [ ] Web Push subscribe ได้ (ปุ่มในหน้าตั้งค่าร้าน)
- [ ] `/superadmin` เข้าได้เฉพาะอีเมลใน `SUPER_ADMIN_USER`
