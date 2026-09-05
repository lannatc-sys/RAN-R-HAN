Blueprint: Rab-R-Han (MVP รอบทดลอง 1 ร้าน)
1. เป้าหมายหลักและขอบเขต (Scope)
เป้าหมาย: ทำระบบให้ร้านอาหารเล็ก 1 ร้านใช้งานจริงก่อน (Schema รองรับ Multi-tenant แต่รอบนี้ใช้แค่ร้านเดียว)

รูปแบบบริการ: สั่งอาหารออนไลน์รับหน้าร้าน (Pick-up) และ พนักงานสั่งแทนลูกค้า (Walk-in)

สิ่งที่ตัดออก (ไม่ทำในเฟสนี้): สแกนสั่งที่โต๊ะ (Dine-in), ระบบพิมพ์บิล, ระบบปิดกะ/Z-Report, แจ้งเตือนผ่าน LINE OA, Option อาหารแบบ 2 ชั้น, ระบบ Superadmin

การแจ้งเตือน: ใช้ Web Push Notification ฟรี 100% (รองรับ iOS/Android)

การชำระเงิน: เงินสด (หน้าเคาน์เตอร์) และ PromptPay (ตรวจสลิปอัตโนมัติด้วยระบบ BYOK - ร้านใส่ API Key ของ SlipOK เอง)

2. Tech Stack
Frontend / Backend: Next.js 15 (App Router) พัฒนาเป็น PWA

Database / Auth / Realtime / Storage: Supabase

QR Code: promptpay-qr + qrcode (สร้างฝั่ง Client)

Hosting: Vercel หรือ VPS

3. โครงสร้างฐานข้อมูล (Database Schema)
ยึดไฟล์ 20260904000001_initial_schema.sql เป็นหลัก และเพิ่ม Migration ใหม่ (20260906000001_pickup_mvp.sql) ดังนี้:

shops: เพิ่ม has_printer (boolean, ล็อกเป็น false), device_mode (text, ล็อกเป็น 'multi_device'), และ kds_pin (text, default '0000' สำหรับล็อกหน้า KDS)

orders: เพิ่ม source (text, 'customer' หรือ 'staff')

payments: เพิ่ม trans_ref (text) พร้อมสร้าง UNIQUE INDEX กันสลิปซ้ำ

shop_payment_credentials (ตารางใหม่): เก็บ API Key แบบเข้ารหัส (AES-256-GCM) ของ SlipOK

payment_slips (ตารางใหม่): เก็บ Raw Payload จาก SlipOK สำหรับ Debug

push_subscriptions (ตารางใหม่): เก็บข้อมูล Web Push Subscription ของพนักงานแต่ละเครื่อง

4. สถาปัตยกรรมฝั่ง Backend & Webhook
สร้างคำสั่งซื้อ: ใช้ RPC create_pickup_order() เพื่อบันทึกข้อมูลและดึง price_snapshot / name_snapshot ลง order_items เสมอ ห้ามดึงราคาจากตารางเมนูในภายหลัง

Webhook (SlipOK): ถอดรหัส API Key ของร้าน -> ตรวจ Secret Header -> ตรวจยอดและบัญชี -> เรียก RPC verify_and_confirm_payment()

ดัก Error 23505: หาก Webhook ส่งสลิปซ้ำ (ชน trans_ref) ระบบต้องดัก Error Code 23505 แล้วตีกลับทันที

Web Push API: มี Endpoint สำหรับ Subscribe (/api/push/subscribe) และส่ง Notification หาพนักงานทุกคนเมื่อมีออเดอร์ใหม่

5. สถาปัตยกรรมฝั่ง Frontend (UI/UX)
หน้าลูกค้า (Public):

แสดงหมวดหมู่และเมนูเฉพาะที่ is_active = true

ตะกร้าสินค้าเลือกจ่ายเงินสด หรือ PromptPay (Dynamic QR สร้างจากยอดรวม)

หน้าสถานะออเดอร์ (Pending -> Confirmed -> Cooking -> Served -> Completed)

หน้าจัดการร้าน (Admin / KDS):

หน้าสั่งแทนลูกค้า: ใช้ UI เดียวกับลูกค้า แต่ระบบบันทึก orders.source = 'staff'

หน้า KDS (คิวออเดอร์):

รับออเดอร์แบบ Realtime

เปลี่ยนสถานะคิวจนถึง "พร้อมรับ (Served)" และ "รับเงินสดแล้ว"

Numpad PIN 4 หลัก: ปรากฏขึ้นเมื่อกด "ยกเลิกออเดอร์" หรือกดเข้าหน้า "ตั้งค่าร้าน/รายงาน"

หน้าตั้งค่าร้าน: กรอก PromptPay, ใส่ SlipOK API Key (Write-only), เปลี่ยน KDS PIN, และปุ่มเปิดแจ้งเตือน Web Push (แนะนำให้ iOS เพิ่มลง Home Screen ก่อน)

6. มาตรฐานความปลอดภัยและการจัดการ Error
Case-sensitive Error Matching: ฝั่ง Next.js ต้องดักจับ Error ข้อความจาก RPC ให้เป๊ะตามอักษรตัวใหญ่-เล็ก (เช่น ORDER_LOCKED, EMPTY_CART) เพื่อแปลเป็นภาษาไทยแสดงผลให้ถูกต้อง

Price Isolation: ระบบต้องรับประกันว่าเมื่อร้านแก้ราคาเมนู ออเดอร์ที่ถูกสร้างไปแล้วราคารวมและราคาต่อจานต้องไม่เปลี่ยนแปลง

API Key Encryption: ห้ามส่ง SlipOK API Key ของร้านไปที่ฝั่ง Client เด็ดขาด การใช้งานต้องทำผ่าน Server Action เท่านั้น

7. แผนการทดสอบขั้นสุดท้าย (End-to-End)
Smoke Test (PromptPay): สั่งอาหาร -> Mock Webhook สลิปผ่าน -> สถานะเปลี่ยนเป็น Confirmed และส่ง Push Notification ลงมือถือพนักงาน

Smoke Test (Cash): สั่งอาหาร -> พนักงานกดรับเงินสดที่ KDS -> สถานะ payments เป็น Verified

Smoke Test (Price Edit): สร้างออเดอร์ค้างไว้ -> แอดมินแก้ราคาเมนู -> บิลเก่าราคาต้องเท่าเดิม

Device Test: ทดสอบ Web Push บน Android และ iPhone (ผ่าน Home Screen Web App) จริง

Security Test: ลองยิง Webhook สลิปเดิมซ้ำ ระบบต้องปฏิเสธ (รหัส 23505)

คุณอยากเริ่มลงมือเขียนโค้ดส่วนไหนก่อนครับ ระหว่างเขียนไฟล์ SQL Migration (pickup_mvp.sql) หรือสร้างโครงสร้างโฟลเดอร์ฝั่ง Next.js?