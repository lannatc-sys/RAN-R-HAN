# 🍽️ RAN-R-HAN (รานร้าน)

ระบบสั่งอาหารออนไลน์และจัดการร้านอาหาร Multi-tenant SaaS (Progressive Web App - PWA) พัฒนาด้วย **Next.js 15 (App Router)**, **Tailwind CSS v4**, และ **Supabase**

---

## 📖 เอกสารระบบ (Documentation)

เอกสารทั้งหมดของโปรเจกต์ได้รับการจัดระเบียบไว้อย่างครบถ้วนในโฟลเดอร์ [`docs/`](file:///d:/system%20make/Ran-R-HAN/docs/):

👉 **[เปิดคลังเอกสารระบบ (Docs Hub)](file:///d:/system%20make/Ran-R-HAN/docs/README.md)**

### เอกสารสำคัญที่ควรอ่าน:
- 📌 **[Project Knowledge](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md)** — แหล่งความจริงหลัก (Single Source of Truth) ของโปรเจกต์
- 🗺️ **[Router Map](file:///d:/system%20make/Ran-R-HAN/docs/router-map.md)** — แผนผังหน้าจอทั้งหมดและสิทธิ์การเข้าถึง
- 📐 **[System Blueprint](file:///d:/system%20make/Ran-R-HAN/docs/Blueprint.md)** — สถาปัตยกรรมและขอบเขตฟังก์ชันระบบ
- 📝 **[TODO & Roadmap](file:///d:/system%20make/Ran-R-HAN/docs/TODO.md)** — รายการงานที่ทำเสร็จแล้วและงานที่ต้องทำต่อ
- 🚀 **[Deployment Guide](file:///d:/system%20make/Ran-R-HAN/docs/DEPLOY.md)** — คู่มือการ Deploy ขึ้น Vercel และ Supabase

---

## 🛠️ Tech Stack หลัก

- **Frontend / Backend:** Next.js 15 (App Router), TypeScript, React 19
- **Styling:** Tailwind CSS v4
- **Database & Auth:** Supabase (PostgreSQL 15+)
- **Push Notification:** Web Push (VAPID)
- **Slip Verification:** SlipOK / OkSlip (BYOK)
- **Map / Location:** Leaflet.js + OpenStreetMap

---

## 💻 การรันโปรเจกต์ในเครื่อง (Development)

```bash
# ติดตั้ง dependencies
pnpm install

# รัน dev server
pnpm dev
```

เปิดเว็บที่ [http://localhost:3000](http://localhost:3000)
