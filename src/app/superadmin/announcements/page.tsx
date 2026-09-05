'use client';

import { useState } from 'react';
import { BellRing, Send, Sparkles, Check, AlertCircle } from 'lucide-react';

export default function SuperadminAnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'info' | 'maintenance' | 'feature'>('feature');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    // จำลองการส่งประกาศ Broadcast ไปยังทุกร้าน
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setTitle('');
      setContent('');
    }, 2500);
  };

  const sampleAnnouncements = [
    {
      id: 1,
      title: 'เปิดตัวระบบความปลอดภัย KDS PIN 4 หลัก',
      content: 'ทุกร้านสามารถตั้งค่า PIN 4 หลักสำหรับป้องกันการยกเลิกออเดอร์มือลั่นและล็อกหน้าตั้งค่าร้านได้แล้ววันนี้',
      type: 'feature',
      date: '5 ก.ย. 2026',
    },
    {
      id: 2,
      title: 'กำหนดการอัปเดตระบบประจำสัปดาห์',
      content: 'ระบบจะทำการบำรุงรักษาในเวลา 03:00 - 03:30 น. ของวันจันทร์ โดยไม่ส่งผลกระทบต่อออเดอร์ย้อนหลัง',
      type: 'maintenance',
      date: '3 ก.ย. 2026',
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          ประกาศระบบ (Platform Announcements)
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          ส่งข้อความแจ้งเตือนหรือประกาศฟีเจอร์ใหม่ไปยังแดชบอร์ดของทุกร้านค้าบนแพลตฟอร์ม
        </p>
      </div>

      {/* Broadcast Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
          <BellRing className="w-5 h-5 text-amber-600" />
          <span>สร้างประกาศใหม่ (Broadcast Announcement)</span>
        </div>

        {isSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>ส่งข้อความประกาศถึงทุกร้านค้าเรียบร้อยแล้ว! 🎉</span>
          </div>
        )}

        <form onSubmit={handleBroadcast} className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หัวข้อประกาศ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น อัปเดตฟีเจอร์ใหม่ประจำเดือน หรือ แจ้งปิดปรับปรุงระบบ"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ประเภทประกาศ
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('feature')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  type === 'feature'
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                ฟีเจอร์ใหม่ (New Feature)
              </button>
              <button
                type="button"
                onClick={() => setType('maintenance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  type === 'maintenance'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                ปิดปรับปรุง (Maintenance)
              </button>
              <button
                type="button"
                onClick={() => setType('info')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  type === 'info'
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                ข่าวสารทั่วไป (General Info)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รายละเอียดเนื้อหา <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ระบุข้อความประกาศที่ต้องการให้ปรากฏบนหน้าจัดการของร้านอาหารทุกร้าน..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ส่งประกาศ Broadcast</span>
            </button>
          </div>
        </form>
      </div>

      {/* History of Announcements */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">ประวัติการประกาศล่าสุด</h2>

        <div className="space-y-3">
          {sampleAnnouncements.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.type === 'feature'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.type === 'feature' ? 'ฟีเจอร์ใหม่' : 'ปิดปรับปรุง'}
                  </span>
                  <span className="font-bold text-xs text-slate-900">{item.title}</span>
                </div>
                <span className="text-[10px] text-slate-400">{item.date}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
