# 📚 คลังเอกสารระบบ RAN-R-HAN (Documentation Hub)

ยินดีต้อนรับสู่ศูนย์รวมเอกสารและการออกแบบระบบ **RAN-R-HAN** (ระบบสั่งอาหารออนไลน์และจัดการร้านอาหาร Multi-tenant SaaS / PWA)

เอกสารทั้งหมดถูกจัดหมวดหมู่ให้ค้นหาและหยิบไปใช้งานได้สะดวก ดังนี้:

---

## 🏛️ 1. สถาปัตยกรรมและภาพรวมระบบ (Architecture & Knowledge)

| เอกสาร | รายละเอียด | ลิงก์ |
|:---|:---|:---:|
| **Project Knowledge** | **แหล่งความจริงหลัก (Single Source of Truth)** รวบรวมภาพรวม, Tech Stack, โครงสร้างโค้ด, กฎเหล็ก และแนวทางปฏิบัติ | [KNOWLEDGE.md](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md) |
| **Rider System Architecture** | สถาปัตยกรรมระบบไรเดอร์และจ่ายงาน (Phase 1) — Work Session GPS, Sequential Offer, Ledger & Settlement | [03-rider-system-architecture.md](file:///d:/system%20make/Ran-R-HAN/docs/03-rider-system-architecture.md) |
| **System Blueprint** | ขอบเขตการทำงาน (Scope) และฟังก์ชันของรอบ MVP (สั่งรับหน้าร้าน Walk-in & Pick-up, ระบบสลิป SlipOK, Web Push) | [Blueprint.md](file:///d:/system%20make/Ran-R-HAN/docs/Blueprint.md) |
| **Router Map** | แผนผังหน้าจอทั้งหมด (Public, Admin, Superadmin, API) พร้อมระบุไฟล์และสิทธิ์การเข้าถึง | [router-map.md](file:///d:/system%20make/Ran-R-HAN/docs/router-map.md) |
| **Database Schema Overview** | สรุปตารางหลักและคอลัมน์สำคัญของระบบฐานข้อมูล Multi-tenant | [schema-overview.md](file:///d:/system%20make/Ran-R-HAN/docs/schema-overview.md) |

---

## 📋 2. แผนงานและข้อกำหนดการพัฒนา (Plans & Specifications)

| เอกสาร | รายละเอียด | ลิงก์ |
|:---|:---|:---:|
| **TODO & Implementation Roadmap** | รายการงานที่ทำเสร็จแล้ว, งานที่ต้องทำต่อ, ประเด็นการตัดสินใจทางเทคนิค และจุดที่ต้องระวัง | [TODO.md](file:///d:/system%20make/Ran-R-HAN/docs/TODO.md) |
| **Zone & Delivery Plan** | แผนงานและข้อตกลงในการพัฒนาระบบเขตและการจัดส่ง (ร้านส่งเอง + พรีออเดอร์) | [zone-delivery-system-plan.md](file:///d:/system%20make/Ran-R-HAN/docs/zone-delivery-system-plan.md) |
| **Store Delivery Design Spec** | เอกสารสเปกการออกแบบฟีเจอร์ส่งของโดยร้าน (Phase 2+) | [superpowers/specs/2026-09-10-store-delivery-design.md](file:///d:/system%20make/Ran-R-HAN/docs/superpowers/specs/2026-09-10-store-delivery-design.md) |

---

## 🚀 3. การติดตั้งและขึ้นระบบ (Deployment & Operations)

| เอกสาร | รายละเอียด | ลิงก์ |
|:---|:---|:---:|
| **Deployment Guide** | คู่มือการ Deploy Frontend บน Vercel และการตั้งค่า Environment Variables / Supabase | [DEPLOY.md](file:///d:/system%20make/Ran-R-HAN/docs/DEPLOY.md) |
| **Project Handoff & Status** | บันทึกสถานะส่งมอบงาน, ฟีเจอร์ล่าสุด, สถานะ Quality Gates (70/70 tests) | [HANDOFF.md](file:///d:/system%20make/Ran-R-HAN/docs/HANDOFF.md) |
| **Project Review Report** | รายงานการรีวิวโครงการ สรุปสถานะสถาปัตยกรรม ความปลอดภัย และความเสี่ยง | [REPORTREVIEW.MD](file:///d:/system%20make/Ran-R-HAN/docs/REPORTREVIEW.MD) |

---

## ⚖️ 4. กฎหมายและระเบียบการใช้งาน (Legal & Compliance)

> ⚠️ **สถานะ: ฉบับร่าง (DRAFT) — ยังไม่พร้อมเผยแพร่ใช้งานจริง** จัดทำโดย AI เป็นจุดเริ่มต้นเท่านั้น ต้องให้ทนายความ/ที่ปรึกษากฎหมายที่มีใบอนุญาตตรวจสอบก่อนเผยแพร่จริงเสมอ มีช่อง `[ต้องกรอก]` ที่เจ้าของร้านต้องเติมเองในเอกสารทั้งสอง

| เอกสาร | รายละเอียด | ลิงก์ |
|:---|:---|:---:|
| **Privacy Policy (ฉบับร่าง)** | นโยบายความเป็นส่วนตัว — ข้อมูลที่เก็บ, วัตถุประสงค์, สิทธิเจ้าของข้อมูล, ระยะเวลาเก็บข้อมูลแยกตามประเภท | [Privacy Policy & Terms of Service/RANRHANนโยบายความเป็นส่วนตัวDRAFT.md](file:///d:/system%20make/Ran-R-HAN/docs/Privacy%20Policy%20%26%20Terms%20of%20Service/RANRHAN%E0%B8%99%E0%B9%82%E0%B8%A2%E0%B8%9A%E0%B8%B2%E0%B8%A2%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B9%80%E0%B8%9B%E0%B9%87%E0%B8%99%E0%B8%AA%E0%B9%88%E0%B8%A7%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%A7DRAFT.md) |
| **Terms of Service (ฉบับร่าง)** | ข้อกำหนดการใช้บริการ — ช่องทางสั่งซื้อ, การชำระเงิน, การยกเลิก/คืนเงิน, ข้อจำกัดความรับผิด | [Privacy Policy & Terms of Service/RANRHANข้อกำหนดการใช้งานDRAFT.md](file:///d:/system%20make/Ran-R-HAN/docs/Privacy%20Policy%20%26%20Terms%20of%20Service/RANRHAN%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%81%E0%B8%B3%E0%B8%AB%E0%B8%99%E0%B8%94%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B8%87%E0%B8%B2%E0%B8%99DRAFT.md) |
| **แนวทางการแก้ไขแอปเพื่อรองรับกฎหมาย (ฉบับร่าง)** | แปลงข้อกำหนดจาก Privacy Policy/ToS เป็นงานเทคนิคที่ต้องทำจริง (WP-19 ถึง WP-24) — หน้าเว็บนโยบาย, consent UI, audit log, ระบบลบข้อมูลอัตโนมัติ | [Privacy Policy & Terms of Service/RANRHANแนวทางแก้ไขแอปเพื่อรองรับกฎหมายDRAFT.md](file:///d:/system%20make/Ran-R-HAN/docs/Privacy%20Policy%20%26%20Terms%20of%20Service/RANRHAN%E0%B9%81%E0%B8%99%E0%B8%A7%E0%B8%97%E0%B8%B2%E0%B8%87%E0%B9%81%E0%B8%81%E0%B9%89%E0%B9%84%E0%B8%82%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%80%E0%B8%9E%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%81%E0%B8%8E%E0%B8%AB%E0%B8%A1%E0%B8%B2%E0%B8%A2DRAFT.md) |
| **รายการตรวจสอบสิ่งที่ต้องดำเนินการด้านกฎหมาย (Checklist)** | สรุปรายการ 4 หมวดที่ต้องส่งตรวจทนาย, กรอกข้อมูลเอง, งานเทคนิค และการจดทะเบียนพาณิชย์ | [Privacy Policy & Terms of Service/RANRHAN_สรุปรายการที่ต้องดำเนินการด้านกฎหมาย_Checklist.md](file:///d:/system%20make/Ran-R-HAN/docs/Privacy%20Policy%20%26%20Terms%20of%20Service/RANRHAN_%E0%B8%AA%E0%B8%A3%E0%B8%B8%E0%B8%9B%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%95%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%94%E0%B8%B3%E0%B9%80%E0%B8%99%E0%B8%B4%E0%B8%99%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%94%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%81%E0%B8%8E%E0%B8%AB%E0%B8%A1%E0%B8%B2%E0%B8%A2_Checklist.md) |

---

## 💡 แนวทางการใช้งานสำหรับผู้พัฒนา / AI Agent

1. **ก่อนเริ่มงานทุกครั้ง**: ควรอ่าน [KNOWLEDGE.md](file:///d:/system%20make/Ran-R-HAN/docs/KNOWLEDGE.md) เสมอ เพื่อเข้าใจบริบทและข้อห้ามของโปรเจกต์
2. **หากต้องการตรวจสอบหน้าจอและสิทธิ์**: อ้างอิงจาก [router-map.md](file:///d:/system%20make/Ran-R-HAN/docs/router-map.md)
3. **หากต้องการดูสถานะงานและข้อตกลงที่ตัดสินใจไปแล้ว**: ตรวจสอบที่ [TODO.md](file:///d:/system%20make/Ran-R-HAN/docs/TODO.md)
