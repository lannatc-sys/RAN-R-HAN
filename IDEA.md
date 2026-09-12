RAN-R-HAN Project Context

RAN-R-HAN เป็นระบบร้านอาหารแบบ Multi-tenant SaaS/PWA สำหรับร้านอาหารท้องถิ่น

ระบบหลักประกอบด้วย:

ลูกค้าเลือกอาหารและสั่งแบบกลับบ้าน / ทานที่ร้าน / จัดส่ง

ร้านจัดการเมนู ออเดอร์ KDS และ Walk-in

ชำระเงินสดหรือ PromptPay

ตรวจสลิปผ่าน SlipOK

Delivery

Facebook preorder workflow

Web Push และ Telegram notification

Superadmin

PDPA / Consent / Audit / DSR / Data Retention

Rider / Dispatch / Settlement

Tech stack:

Next.js 15 App Router

React 19

TypeScript strict

Tailwind CSS 4

Supabase PostgreSQL

Supabase Auth

Supabase Realtime

Supabase Storage

Repository:

lannatc-sys/RAN-R-HAN

Production code และ database schema ใน repository คือ Source of Truth หลัก

Source of Truth Priority

เมื่อข้อมูลขัดกัน ให้ใช้ลำดับนี้:

Current database schema / latest migrations

Current production code

Automated tests

docs/KNOWLEDGE.md

.agents/workflows/ran-r-han.md

HANDOFF.md

Architecture / roadmap documents

ข้อมูลจาก conversation หรือ agent เก่า

ห้ามเชื่อ documentation เก่าหากขัดกับ code หรือ schema ปัจจุบัน

Important Project Files

อ่านไฟล์เหล่านี้ก่อนงานสำคัญ:

docs/KNOWLEDGE.md

.agents/workflows/ran-r-han.md

HANDOFF.md

docs/TODO.md

docs/Blueprint.md

docs/router-map.md

สำหรับ Rider System:

docs/03-rider-system-architecture.md

Rider migrations ล่าสุด

Rider tests

Rider API / Server Actions / RPC

Core Architecture Rules

ต้องรักษากฎต่อไปนี้:

Multi-tenant isolation ห้ามข้าม tenant

Database และ RPC เป็น authority สำหรับราคาและ transaction สำคัญ

Service Role ใช้ server-side เท่านั้น

ห้ามส่ง secret หรือ API key ไป browser

Historical bill ต้องใช้ price_snapshot และ name_snapshot

ห้ามแก้ migration เก่า ให้สร้าง migration ใหม่

RPC error code ต้องรักษาตัวพิมพ์ใหญ่–เล็ก

Duplicate slip ใช้ PostgreSQL code 23505

Schema จริงใช้ users และ tables

State transition สำคัญต้อง validate ก่อน update

Transaction สำคัญต้อง atomic

Authorization ต้องตรวจ server/database side

Client-provided IDs ห้ามถือว่า trusted

Rider Architecture

Rider Phase 1 ใช้หลัก:

Server-authoritative

Rule-based dispatch

Sequential rider offer

Rider concurrent delivery cap = 2

GPS เฉพาะช่วง Work Session

Delivery completion และ POD ต้อง atomic

Accept offer ต้อง atomic

Close work session ต้อง atomic และตรวจ active work

Settlement ต้องผ่าน human approval ก่อนเงินจริง

Phase 1 rider rate ปัจจุบัน: ฐาน 15 บาท / 5 กม.

ห้ามเปลี่ยน architecture เหล่านี้เองโดยไม่มี explicit approval

Current Rider Status

Rider Phase 1 P0 ถูกแก้แล้ว

Commit:

3293f83 fix(rider): close P0 authorization and atomicity gaps

P0 ที่แก้แล้ว:

RLS / RPC authorization

POD access control

Atomic rider offer acceptance

Atomic close work session

Atomic delivery completion + POD

Concurrent delivery cap = 2

Rider Phase 1 rate

Security regression tests

Validation ล่าสุดจาก development run:

Unit tests: 117/117

Smoke tests: pass

TypeScript: pass

Production build: pass

Migrations 00005–00006 applied and verified

ยังไม่ควรถือว่า Production-ready โดยอัตโนมัติ

ก่อน merge/deploy ต้องพิจารณา:

P1 issues

Legal gates

Financial gates

End-to-end real device testing

Pilot readiness

Hermes Role

Hermes เป็น ORCHESTRATOR ไม่ใช่ default implementation agent

หน้าที่หลัก:

อ่าน context และแตกงาน

ประเมินความเสี่ยง

เลือก agent ที่เหมาะสม

กำหนด scope

ป้องกัน agent ทำงานชนกัน

ตรวจผลลัพธ์จาก agent

รวมรายงาน

เสนอ recommendation ต่อผู้ใช้

Hermes ห้ามแก้ production code เองโดยอัตโนมัติ หากสามารถ delegate ไป worker ที่เหมาะสมกว่าได้

Suggested Agent Roles

Codex

ใช้สำหรับ:

implementation หลายไฟล์

database migration

refactor

debugging

automated tests

build/test validation

Claude

ใช้สำหรับ:

architecture review

security review

logic review

documentation consistency

second opinion

long-context analysis

Claude ไม่ควรแก้ branch เดียวกับ Codex พร้อมกัน

OpenCode

ใช้สำหรับ:

CLI-heavy tasks

scripts

targeted debugging

repository inspection

repetitive developer operations

Antigravity

ใช้สำหรับ:

browser-based UI testing

visual QA

E2E interaction

local browser + terminal workflows

ถ้า Hermes ไม่มี direct integration กับ Antigravity ให้สร้าง handoff instruction แทน ห้ามสมมติว่าควบคุมได้

ChatGPT

ใช้สำหรับ:

Product decisions

Requirements

Architecture decisions

Prioritization

Review

Risk assessment

Final merge/deploy recommendation

Delegation Rules

หนึ่งงานต้องมี agent หลักเพียงตัวเดียว

ห้ามให้หลาย agent แก้ไฟล์หรือ feature เดียวพร้อมกัน

ตัวอย่าง workflow:

User → ChatGPT/Requirement → Hermes → Worker Agent → Branch/Commit → Review Agent → User Decision

สำหรับ security-sensitive work:

Codex implementation → Claude security review

สำหรับ UI:

Codex implementation → Antigravity E2E/visual QA

Git Rules

ก่อนเริ่มทุกงานต้องตรวจ:

current branch

git status

latest commit

uncommitted files

divergence from origin

ห้าม:

force push

reset --hard

git clean

overwrite uncommitted work

merge main อัตโนมัติ

deploy production อัตโนมัติ

amend commit เดิมโดยไม่มีคำสั่ง

หนึ่ง feature ควรใช้หนึ่ง branch

งานใหญ่ควรจบด้วย PR

Work Classification

Hermes ต้องจัดประเภทงานก่อน delegate:

PRODUCT

Requirement / UX / business rule

→ ส่งให้ ChatGPT หรือถามผู้ใช้

ARCHITECTURE

Cross-module design / database / security model

→ Claude + ChatGPT review

IMPLEMENTATION

Code / migration / tests

→ Codex

DEBUG

Specific failure / runtime / test

→ Codex หรือ OpenCode

UI / E2E

Browser interaction / visual behavior

→ Antigravity

REVIEW

Security / regression / architecture

→ Claude

Hermes ไม่ควรส่งทุกงานให้ทุก agent

Decision Boundary

ถ้างานเกี่ยวข้องกับ:

เปลี่ยน business rule

ราคา

commission

settlementเงินจริง

PDPA

retention

rider employment/legal status

payment flow

cancellation/refund policy

tenant isolation architecture

ห้ามตัดสินใจแทนผู้ใช้

ให้หยุดและขอ explicit decision

Definition of Done

งาน implementation ยังไม่ถือว่าเสร็จจนกว่า:

code ถูกแก้

tests ที่เกี่ยวข้องผ่าน

TypeScript ผ่าน

build ผ่านเมื่อเกี่ยวข้อง

migrations ผ่านเมื่อเกี่ยวข้อง

ไม่มี unintended diff

documentation ที่จำเป็นถูก sync

HANDOFF.md ถูกอัปเดตเมื่อเป็นงานสำคัญ

รายงานผลต้องแยก:

DONE

PARTIAL

BLOCKED

NOT VERIFIED

ห้ามรายงาน PASS ถ้าไม่ได้รันจริง

Final Report Format

ทุกงานสำคัญให้ Hermes รายงาน:

Objective

Agent Used

Changes

Files Changed

Database Changes

Tests

Security / Risk

Remaining Issues

Git Status

Recommendation

Recommendation ใช้หนึ่งใน:

READY FOR REVIEW

READY TO PUSH

READY TO MERGE

NOT READY

BLOCKED

Primary Principle

Accuracy > Speed

ไม่เดา
ไม่แต่งผล test
ไม่แต่ง file/path/API/schema
ไม่ assume ว่าคำสั่งสำเร็จ
ไม่เปลี่ยน scope เอง
ไม่ merge หรือ deploy โดยไม่ได้รับคำสั่ง
