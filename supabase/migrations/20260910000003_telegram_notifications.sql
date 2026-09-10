-- ==============================================================================
-- RAN-R-HAN Migration: Telegram Notifications & Link Tokens
-- File: supabase/migrations/20260910000003_telegram_notifications.sql
-- Description: เพิ่มฟิลด์ telegram_enabled ใน shops, telegram_chat_id ใน orders,
--              และสร้างตาราง telegram_link_tokens สำหรับเชื่อมต่อ Telegram Bot
-- ==============================================================================

-- 1. เพิ่มฟิลด์ telegram_enabled ในตาราง shops (ค่าเริ่มต้น: TRUE)
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. เพิ่มฟิลด์ telegram_chat_id ในตาราง orders สำหรับบันทึก Chat ID ของลูกค้า
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- สร้าง index ค้นหา orders จาก telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_orders_telegram_chat_id 
ON public.orders(telegram_chat_id);

-- 3. สร้างตาราง telegram_link_tokens สำหรับจับคู่ Order กับ Telegram Chat ID (อายุ 15 นาที)
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index สำหรับค้นหา token และ order_id
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_order_id 
ON public.telegram_link_tokens(order_id);

CREATE INDEX IF NOT EXISTS idx_telegram_tokens_active 
ON public.telegram_link_tokens(token) 
WHERE used = FALSE;

-- 4. เปิดใช้งาน RLS และนโยบายความปลอดภัย
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- นโยบาย: อนุญาตให้อ่าน token ที่ยังไม่หมดอายุและยังไม่ได้ใช้งาน
DROP POLICY IF EXISTS "Allow read active telegram link tokens" ON public.telegram_link_tokens;
CREATE POLICY "Allow read active telegram link tokens"
ON public.telegram_link_tokens
FOR SELECT
USING (expires_at > NOW() AND used = FALSE);

-- นโยบาย: Service role สามารถจัดการข้อมูลได้ทุกประการ (bypass RLS by default)
