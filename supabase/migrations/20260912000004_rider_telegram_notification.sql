-- ==============================================================================
-- RAN-R-HAN Migration: Rider Notification Channels (Web Push & Telegram)
-- File: supabase/migrations/20260912000004_rider_telegram_notification.sql
-- Description: เพิ่มฟิลด์ telegram_chat_id และ push_enabled ในตาราง riders
--              เพื่อรองรับการแจ้งเตือนงานจริงผ่าน Web Push และ Telegram Bot
-- ==============================================================================

-- 1. เพิ่ม telegram_chat_id สำหรับรับแจ้งเตือนผ่าน Telegram Bot (@ranrhan_bot)
ALTER TABLE public.riders 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- สร้าง index ค้นหา rider จาก telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_riders_telegram_chat 
ON public.riders(telegram_chat_id);

CREATE INDEX IF NOT EXISTS idx_riders_telegram_chat_id 
ON public.riders(telegram_chat_id);

-- 2. เพิ่ม push_enabled สำหรับเปิด/ปิดการแจ้งเตือนผ่าน Web Push
ALTER TABLE public.riders 
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. ตรวจสอบสิทธิ์ (Permissions)
GRANT SELECT, UPDATE ON public.riders TO authenticated;
GRANT ALL ON public.riders TO service_role;

COMMENT ON COLUMN public.riders.telegram_chat_id IS 'Telegram Chat ID ของไรเดอร์ สำหรับส่งแจ้งเตือนงานผ่าน Bot';
COMMENT ON COLUMN public.riders.push_enabled IS 'สถานะเปิดรับการแจ้งเตือน Web Push ของไรเดอร์';
