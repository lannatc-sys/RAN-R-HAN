# External Cron Setup Guide — RAN-R-HAN Dispatch Timeout

> คู่มือตั้งค่า External Scheduler สำหรับ `/api/cron/dispatch-timeout`
> วัตถุประสงค์: ให้ระบบ expire dispatch offers ทุก 1 นาที โดยไม่ต้องรอให้มี dispatch ใหม่
> **ห้าม deploy production จนกว่าจะผ่าน review** (ดู §Pre-Deployment Checklist)

---

## 🎯 ทำไมต้องใช้ External Cron?

ปัจจุบันระบบมีกลไก **cleanup-on-next-dispatch** — คือเมื่อมีการ dispatch ใหม่ จะเรียก `timeoutOfferAction()` ก่อนเพื่อเก็บกวาด offer ที่หมดเวลา

**Problem:** หากช่วงหนึ่งไม่มี dispatch เกิดขึ้น offer ที่หมดอายุอาจค้างในสถานะ `offered` นานเกิน 30 วินาที ซึ่ง:
- กระทบ sequential dispatch — order ค้างในสถานะ `dispatching` ไม่ได้รีเซ็ตกลับไป `pending`
- Monitoring — ไม่มี event ที่แสดงว่า offer หมดอายุจริง
- Race condition — ถ้ามี dispatch เกิดขึ้นหลังจากนั้น ระบบจะ clean ทันทีแต่ไม่ได้บันทึกว่าเคยค้างนานเท่าไร

**Solution:** External Scheduler เรียก `/api/cron/dispatch-timeout` ทุก 1 นาทีเป็น primary processor และคง cleanup-on-next-dispatch เป็น fallback safety net

---

## 📋 ขั้นตอนการตั้งค่า

### 1. Generate CRON_SECRET

```bash
# สร้าง random secret 32 ไบต์ (64 ตัวอักษร hex)
openssl rand -hex 32
# ตัวอย่าง: a1b2c3d4e5f6...64 ตัวอักษร

# เพิ่มใน .env.local (ในทุก environment)
CRON_SECRET=<ค่าที่สร้างได้>
```

**ห้าม commit .env.local ลง git** — เพิ่มใน `.env.local` เท่านั้น และแจ้งค่า secret ให้คนที่ตั้งค่า cron ทราบผ่านช่องทางที่ปลอดภัย (ไม่ใช่แชร์ใน chat)

### 2. Deploy ก่อนเปิดใช้ cron

```bash
# 1. ตรวจสอบว่า deployment สำเร็จ
pnpm build

# 2. Deploy ไปยัง Vercel (หรือ platform ที่ใช้)
# ตรวจสอบว่า /api/cron/dispatch-timeout สามารถเข้าถึงได้
curl -H "Authorization: Bearer wrong-secret" https://your-domain.vercel.app/api/cron/dispatch-timeout
# Expected: {"error":"Unauthorized"} (401)

curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.vercel.app/api/cron/dispatch-timeout
# Expected: {"ok":true,"expired":0,"redispatched":0,"errors":0,"ran_at":"..."}
```

### 3. เลือก External Scheduler

#### ตัวเลือก A: cron-job.org (ฟรี, ใช้งานง่าย)

1. สมัครที่ [cron-job.org](https://cron-job.org)
2. สร้าง cron job ใหม่
3. ตั้งค่า:
   - **URL:** `https://your-domain.vercel.app/api/cron/dispatch-timeout`
   - **Method:** `GET` (หรือ `POST` — ทั้งคู่รองรับ)
   - **Schedule:** `Every 1 minute` (หรือ `*/1 * * * *`)
   - **Headers:** `Authorization: Bearer $CRON_SECRET`
   - **Timeout:** 30 วินาที
   - **Retries:** 3 (ดีที่สุด)
4. เซฟและทดสอบด้วยปุ่ม "Run now"

#### ตัวเลือก B: GitHub Actions + Cron (ถ้า deploy อยู่บน GitHub/Vercel)

```yaml
# .github/workflows/dispatch-timeout-cron.yml
name: Dispatch Timeout Cron

on:
  schedule:
    - cron: '*/1 * * * *'  # ทุก 1 นาที

jobs:
  dispatch-timeout:
    runs-on: ubuntu-latest
    steps:
      - name: Call Dispatch Timeout Endpoint
        run: |
          curl -s -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.vercel.app/api/cron/dispatch-timeout
```

**Note:** GitHub Actions มีข้อจำกัด — free tier ใช้ได้ 2000 นาที/เดือน และ schedule รันบนเครื่อง shared ซึ่งอาจไม่แม่นยำ 100% แต่ใช้งานได้

#### ตัวเลือก C: Vercel Cron (如果有ใช้ Vercel Pro)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/dispatch-timeout",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

**Note:** Vercel Cron ใช้ internal scheduling — ไม่ต้องตั้งค่า external secret เพราะ Vercel ตรวจสอบมาจากระบบเอง แต่ต้องตั้งค่า CRON_SECRET ใน Vercel env variables ด้วย

### 4. ตรวจสอบการทำงาน

หลังจากตั้งค่าแล้ว 1-2 นาที ตรวจสอบ:

```bash
# ดู log ใน Vercel (หรือ platform ที่ใช้)
# ค้นหาคำว่า "[cron/dispatch-timeout]" ใน log

# หรือเรียกดู summary จาก endpoint โดยตรง
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/dispatch-timeout | jq
```

**Expected log pattern:**
```
[cron/dispatch-timeout] สำเร็จ: expired=0, redispatched=0, errors=0, ran_at=2026-09-12T...
```

---

## 🔒 Security Checklist (ทำก่อนเปิดใช้จริง)

| Check | วิธีตรวจสอบ |
|-------|--------------|
| **Endpoint ไม่เปิดเผย public** | ลองเข้าถึงโดยไม่มี header — ต้องได้ 401 |
| **CRON_SECRET ไม่ commit ลง git** | `git grep CRON_SECRET` — ต้องไม่พบใน repository |
| **CRON_SECRET มีความยาวพอ** | ควรยาว ≥32 ไบต์ (64 ตัวอักษร hex) |
| **Response มีเฉพาะข้อมูลที่จำเป็น** | ไม่ควรแสดง error message ละเอียดเกินไปเมื่อ auth ล้มเหลว |
| **ไม่มี client-side reference ถึง cron endpoint** | กันไม่ให้ browser เรียกโดยไม่ได้ตั้งใจ |

---

## ✅ Pre-Deployment Checklist (ทำก่อน deploy production)

ก่อน deploy cron ไป production ต้องตรวจสอบ:

- [ ] **Auth:** ลองเรียกโดยไม่มี Authorization header — ต้องได้ 401
- [ ] **Auth:** ลองเรียกด้วย secret ผิด — ต้องได้ 401
- [ ] **Auth:** ลองเรียกด้วย secret ถูกต้อง — ต้องได้ 200 พร้อม response ที่ถูกต้อง
- [ ] **Idempotency:** เรียกซ้ำ 2 ครั้งติดกัน — ต้องไม่เกิดผลข้างเคียงซ้ำ (offer เดียวกันไม่ถูก expired ซ้ำ)
- [ ] **Concurrency:** จำลอง concurrent calls (สั่ง 2 request พร้อมกัน) — ต้องไม่เกิด double-expire
- [ ] **Database authority:** ตรวจสอบว่า RPC ใช้ `now()` ของฐานข้อมูล ไม่ใช่ timestamp จาก client
- [ ] **Logging:** ตรวจสอบ log ว่ามีการบันทึก `expired`, `redispatched`, `errors` ทุกครั้ง
- [ ] **Fallback:** ตรวจสอบว่า `dispatchOrderAction` ยังคงเรียก `timeoutOfferAction()` เป็น fallback อยู่
- [ ] **Error handling:** จำลองกรณีฐานข้อมูล error — ต้องไม่ทำให้ระบบหยุดทำงานทั้งหมด
- [ ] **Response format:** ตรวจสอบว่า response มี `expired`, `redispatched`, `errors`, `ran_at`

---

## 🚨 หาก Cron ล้มเหลว

- **ปัญหาที่ 1: Endpoint ไม่ตอบ** — ตรวจสอบ deployment, ตรวจสอบ capacity
- **ปัญหาที่ 2: Auth ล้มเหลว** — ตรวจสอบว่า secret ใน scheduler ตรงกับ `.env.local`
- **ปัญหาที่ 3: Database error** — ตรวจสอบ log error, ตรวจสอบ connection
- **ปัญหาที่ 4: Overlapping run** — ตรวจสอบว่า advisory lock ทำงาน (migration 20260912000001)

**Recovery:** ระบบยังทำงานต่อได้เพราะมี fallback คือ cleanup-on-next-dispatch — แต่ถ้าอยากให้ rapid recovery ให้เรียก endpoint ด้วยตนเอง:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/dispatch-timeout
```

---

## 📊 Monitoring

แนะนำให้ monitor:

1. **Response time:** ค่าเฉลี่ยควร < 500ms
2. **Error rate:** ควร < 1% ของ total requests
3. **Expired count per run:** ปกติควรเป็น 0 ส่วนใหญ่ — ถ้ามีค่าสูงแสดงว่ามี offer ค้างมาก
4. **Redispatched count:** ควรสัมพันธ์กับ expired — ถ้ามี redispatched มากแสดงว่าระบบ dispatch ทำงาน

---

เอกสารนี้เป็น DRAFT สำหรับการตั้งค่าระบบ ยังไม่ได้ผ่านการทดสอบใน production จริง
โปรดทดสอบในสภาพแวดล้อม staging ก่อน deploy ไป production
