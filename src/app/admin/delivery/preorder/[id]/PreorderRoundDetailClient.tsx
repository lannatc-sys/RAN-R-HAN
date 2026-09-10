'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PreorderRound,
  PreorderItem,
  DeliveryLocation,
  PreorderRoundStatus,
  ParsedCommentOrder,
} from '@/lib/types';
import { parseBulkComments } from '@/lib/delivery-parser';
import {
  updatePreorderRoundStatusAction,
  addPreorderItemAction,
  addBulkPreorderItemsAction,
  deletePreorderItemAction,
  convertPreorderRoundToTripAction,
} from '@/app/actions/delivery';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  Truck,
  CheckCircle2,
  Phone,
  DollarSign,
  Package,
  Layers,
  FileText,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';

interface PreorderRoundDetailClientProps {
  initialRound: PreorderRound;
  initialItems: PreorderItem[];
  availableLocations: DeliveryLocation[];
}

export function PreorderRoundDetailClient({
  initialRound,
  initialItems,
  availableLocations,
}: PreorderRoundDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [round, setRound] = useState<PreorderRound>(initialRound);
  const [items, setItems] = useState<PreorderItem[]>(initialItems);

  // Tabs: 'comments' (Smart Parser) vs 'manual'
  const [activeTab, setActiveTab] = useState<'comments' | 'manual'>('comments');

  // Smart Parser state
  const [rawComments, setRawComments] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedCommentOrder[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Manual Form state
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualLocationId, setManualLocationId] = useState(availableLocations[0]?.id || '');
  const [manualNote, setManualNote] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualTotal, setManualTotal] = useState<number>(0);
  const [manualPayment, setManualPayment] = useState<'promptpay' | 'cash'>('cash');

  // Status and conversion state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculations
  const totalRevenue = items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const totalOrders = items.length;

  // Handle parsing Facebook comments
  const handleParseComments = () => {
    if (!rawComments.trim()) return;
    setIsParsing(true);
    try {
      const parsed = parseBulkComments(rawComments, availableLocations);
      setParsedResults(parsed);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg('เกิดข้อผิดพลาดในการวิเคราะห์ข้อความ');
    } finally {
      setIsParsing(false);
    }
  };

  // Update single parsed row before saving
  const handleUpdateParsedItem = (
    index: number,
    field: keyof ParsedCommentOrder,
    value: any
  ) => {
    setParsedResults(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remove a row from parsed preview
  const handleRemoveParsedItem = (index: number) => {
    setParsedResults(prev => prev.filter((_, i) => i !== index));
  };

  // Save all parsed items into DB
  const handleSaveBulkParsed = () => {
    if (parsedResults.length === 0) return;

    startTransition(async () => {
      setErrorMsg(null);
      const rows = parsedResults.map(p => ({
        recipient_name: p.recipient_name,
        recipient_phone: p.recipient_phone,
        location_id: p.location_id,
        location_note: p.location_note,
        items_summary: p.items_summary,
        total_amount: Number(p.total_amount) || 0,
        payment_method: 'cash' as const,
        raw_input_text: p.raw_text,
      }));

      const res = await addBulkPreorderItemsAction(round.id, rows);
      if (res.success) {
        setSuccessMsg(`บันทึกสำเร็จ ${res.count} รายการ`);
        setRawComments('');
        setParsedResults([]);
        router.refresh();
      } else {
        setErrorMsg(res.error || 'บันทึกไม่สำเร็จ');
      }
    });
  };

  // Save single manual item
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualSummary) {
      setErrorMsg('กรุณากรอกชื่อผู้รับและรายการสินค้า');
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      const res = await addPreorderItemAction({
        round_id: round.id,
        recipient_name: manualName,
        recipient_phone: manualPhone,
        location_id: manualLocationId || undefined,
        location_note: manualNote || undefined,
        items_summary: manualSummary,
        total_amount: Number(manualTotal) || 0,
        payment_method: manualPayment,
      });

      if (res.success && res.data) {
        setItems(prev => [...prev, res.data!]);
        setManualName('');
        setManualPhone('');
        setManualNote('');
        setManualSummary('');
        setManualTotal(0);
        setSuccessMsg('เพิ่มรายการสำเร็จ');
      } else {
        setErrorMsg(res.error || 'ไม่สามารถเพิ่มรายการได้');
      }
    });
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('ยืนยันลบรายการนี้?')) return;
    try {
      const res = await deletePreorderItemAction(itemId, round.id);
      if (res.success) {
        setItems(prev => prev.filter(i => i.id !== itemId));
      } else {
        setErrorMsg(res.error || 'ลบไม่สำเร็จ');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Update round status
  const handleStatusChange = async (newStatus: PreorderRoundStatus) => {
    try {
      const res = await updatePreorderRoundStatusAction(round.id, newStatus);
      if (res.success) {
        setRound(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Convert to delivery trip
  const handleConvertToTrip = () => {
    if (items.length === 0) {
      alert('รอบนี้ยังไม่มีรายการสั่งจอง กรุณาเพิ่มรายการก่อนแปลงเป็นเที่ยวส่ง');
      return;
    }

    if (!confirm(`ต้องการแปลงรอบพรีออเดอร์ "${round.title}" เป็น "เที่ยวส่งของ (Delivery Trip)" หรือไม่?`)) {
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);
      const res = await convertPreorderRoundToTripAction(round.id);
      if (res.success && res.tripId) {
        router.push(`/admin/delivery/trips/${res.tripId}`);
      } else {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการแปลงเป็นเที่ยวส่ง');
      }
    });
  };

  const getStatusBadge = (status: PreorderRoundStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            ● เปิดรับออเดอร์
          </span>
        );
      case 'closed':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            ปิดรับแล้ว
          </span>
        );
      case 'completed':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
            แปลงเป็นเที่ยวส่งแล้ว
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button and Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/delivery/preorder"
            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
                {round.title}
              </h1>
              {getStatusBadge(round.status)}
            </div>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-emerald-600" />
                ส่งวันที่: <strong>{round.delivery_date}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-amber-600" />
                ปิดรับ: <strong>{new Date(round.cutoff_at).toLocaleString('th-TH')}</strong>
              </span>
              {round.delivery_time_window && (
                <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800">
                  {round.delivery_time_window}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={round.status}
            onChange={e => handleStatusChange(e.target.value as PreorderRoundStatus)}
            className="px-3 py-2 text-xs sm:text-sm font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="open">เปิดรับออเดอร์</option>
            <option value="closed">ปิดรับชั่วคราว</option>
            <option value="completed">เสร็จสิ้น / แปลงแล้ว</option>
          </select>

          <button
            onClick={handleConvertToTrip}
            disabled={isPending || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Truck className="w-4 h-4" />
            {isPending ? 'กำลังแปลง...' : 'แปลงเป็นเที่ยวส่ง (Create Trip)'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs sm:text-sm mb-1">
            <Package className="w-4 h-4 text-emerald-500" />
            จำนวนออเดอร์
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">
            {totalOrders}{' '}
            <span className="text-xs font-normal text-stone-500">คน</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs sm:text-sm mb-1">
            <DollarSign className="w-4 h-4 text-amber-500" />
            ยอดเงินรวม
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ฿{totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs sm:text-sm mb-1">
            <Layers className="w-4 h-4 text-blue-500" />
            จุดรับสินค้า
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">
            {new Set(items.map(i => i.location_id).filter(Boolean)).size}{' '}
            <span className="text-xs font-normal text-stone-500">แห่ง</span>
          </div>
        </div>
      </div>

      {/* Order Input Section (Tabs) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="flex border-b border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={clsx(
              'flex-1 py-3 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition border-b-2',
              activeTab === 'comments'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            )}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            วางคอมเมนต์ Facebook (Smart Parser)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={clsx(
              'flex-1 py-3 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition border-b-2',
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            )}
          >
            <Plus className="w-4 h-4" />
            กรอกทีละรายการ (Manual)
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'comments' ? (
            <div className="space-y-4">
              {/* PDPA Preorder Notice Banner (WP-21) */}
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>คำแนะนำตามระเบียบ PDPA สำหรับการรับออเดอร์ผ่าน Facebook</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                  ก่อนเปิดรับออเดอร์ในกลุ่ม/เพจ แนะนำให้พนักงานคัดลอกข้อความด้านล่างนี้แปะในโพสต์:
                </p>
                <div className="p-2 rounded bg-white/80 dark:bg-stone-900/80 border border-blue-200/60 dark:border-blue-800/40 font-mono text-[11px] text-stone-700 dark:text-stone-300 select-all">
                  &ldquo;การคอมเมนต์สั่งซื้อในโพสต์นี้ ถือว่าท่านยินยอมให้ร้านบันทึกชื่อ เบอร์โทร และจุดรับสินค้า เพื่อการจัดเตรียมและจัดส่งอาหารในรอบนี้เท่านั้น&rdquo;
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  วางข้อความคอมเมนต์ลูกค้าจาก Facebook หรือ Line (บรรทัดละ 1 คน):
                </label>
                <textarea
                  rows={4}
                  value={rawComments}
                  onChange={e => setRawComments(e.target.value)}
                  placeholder={`ตัวอย่าง:\nสมชาย 0812345678 รพ.ศรีสังวาลย์ ข้าวซอยไก่ 2 ถุง\nวรรณา 0899998888 ตลาดเทศบาล ขนมจีนน้ำเงี้ยว 1 ชาม\nคุณแดง 0851112233 หนองจองคำ ข้าวผัด 3 กล่อง`}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  ระบบจะสกัด <strong>ชื่อ, เบอร์โทรศัพท์, จุดรับส่งแม่ฮ่องสอน, และรายการสินค้า</strong> ให้อัตโนมัติ
                </p>
                <button
                  type="button"
                  onClick={handleParseComments}
                  disabled={!rawComments.trim() || isParsing}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 dark:text-amber-500" />
                  {isParsing ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ข้อความ (Smart Parse)'}
                </button>
              </div>

              {/* Parsed Preview Table */}
              {parsedResults.length > 0 && (
                <div className="mt-6 space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ผลการแกะข้อมูล ({parsedResults.length} คน)
                      <span className="text-xs font-normal text-stone-500 ml-1">
                        (สามารถตรวจทานหรือแก้ไขก่อนบันทึกได้)
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleSaveBulkParsed}
                      disabled={isPending}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {isPending ? 'กำลังบันทึก...' : 'ยืนยันนำเข้าทั้งหมด'}
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-700">
                        <tr>
                          <th className="p-2.5">ชื่อผู้รับ</th>
                          <th className="p-2.5">เบอร์โทร</th>
                          <th className="p-2.5">จุดรับสินค้า</th>
                          <th className="p-2.5">รายการสินค้า</th>
                          <th className="p-2.5 w-24">ยอดเงิน (฿)</th>
                          <th className="p-2.5 text-center w-12">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                        {parsedResults.map((item, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.recipient_name}
                                onChange={e => handleUpdateParsedItem(idx, 'recipient_name', e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.recipient_phone}
                                onChange={e => handleUpdateParsedItem(idx, 'recipient_phone', e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.location_id || ''}
                                onChange={e => handleUpdateParsedItem(idx, 'location_id', e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                              >
                                <option value="">-- ไม่ระบุ / รับที่อื่น --</option>
                                {availableLocations.map(loc => (
                                  <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.items_summary}
                                onChange={e => handleUpdateParsedItem(idx, 'items_summary', e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={item.total_amount || 0}
                                onChange={e => handleUpdateParsedItem(idx, 'total_amount', Number(e.target.value))}
                                className="w-full px-2 py-1 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-right"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveParsedItem(idx)}
                                className="p-1 text-stone-400 hover:text-red-600 rounded transition"
                                title="ลบแถวนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual Form */
            <form onSubmit={handleAddManualItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    ชื่อผู้รับ / ลูกค้า *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="เช่น คุณสมชาย"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                    placeholder="0812345678"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    จุดรับสินค้า (Location)
                  </label>
                  <select
                    value={manualLocationId}
                    onChange={e => setManualLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  >
                    <option value="">-- ไม่ระบุจุดรับ / ระบุในหมายเหตุ --</option>
                    {availableLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    หมายเหตุจุดส่ง (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={e => setManualNote(e.target.value)}
                    placeholder="เช่น ตึกอำนวยการ ชั้น 2"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  รายการสินค้าที่สั่ง *
                </label>
                <input
                  type="text"
                  required
                  value={manualSummary}
                  onChange={e => setManualSummary(e.target.value)}
                  placeholder="เช่น ข้าวซอยไก่พิเศษ 2 ถุง, น้ำพริกอ่อง 1 กล่อง"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    ยอดเงินรวม (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={manualTotal}
                    onChange={e => setManualTotal(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    ช่องทางชำระเงิน
                  </label>
                  <select
                    value={manualPayment}
                    onChange={e => setManualPayment(e.target.value as 'promptpay' | 'cash')}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white"
                  >
                    <option value="cash">เงินสด / เก็บเงินปลายทาง (Cash / COD)</option>
                    <option value="promptpay">โอนผ่านพร้อมเพย์ (PromptPay)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {isPending ? 'กำลังบันทึก...' : 'บันทึกออเดอร์'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Orders List Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
              รายการสั่งจองในรอบนี้ ({items.length} รายการ)
            </h2>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-sm">
            ยังไม่มีรายการสั่งจองในรอบนี้ — คุณสามารถวางคอมเมนต์ Facebook ด้านบนเพื่อเริ่มนำเข้าข้อมูล
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">ชื่อลูกค้า</th>
                  <th className="py-3 px-4">เบอร์โทร</th>
                  <th className="py-3 px-4">จุดรับสินค้า</th>
                  <th className="py-3 px-4">รายการสินค้า</th>
                  <th className="py-3 px-4 text-right">ยอดเงิน</th>
                  <th className="py-3 px-4 text-center">การชำระ</th>
                  <th className="py-3 px-4 text-center w-16">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                {items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                    <td className="py-3 px-4 text-center text-stone-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900 dark:text-white">
                      {item.recipient_name}
                    </td>
                    <td className="py-3 px-4">
                      {item.recipient_phone ? (
                        <a
                          href={`tel:${item.recipient_phone}`}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-mono"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {item.recipient_phone}
                        </a>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-stone-800 dark:text-stone-200">
                        {item.location?.name || 'ไม่ระบุจุดรับ'}
                      </div>
                      {item.location_note && (
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {item.location_note}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-700 dark:text-stone-300">
                      {item.items_summary}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      ฿{Number(item.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 text-xs rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 uppercase">
                        {item.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 rounded transition"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
