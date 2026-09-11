'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRiderAction, updateRiderStatusAction } from '@/app/actions/rider-admin';
import {
  Bike,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Mail,
  Lock,
  Phone,
  User,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface Rider {
  id: string;
  display_name: string;
  phone: string;
  vehicle_type: string;
  status: 'active' | 'inactive' | 'suspended';
  performance_score: number;
  created_at: string;
  auth_user_id: string | null;
  telegram_chat_id?: string | null;
  push_enabled?: boolean;
  is_online: boolean;
}

interface RidersClientProps {
  riders: Rider[];
  shopId: string;
}

const STATUS_LABEL: Record<Rider['status'], string> = {
  active: 'ใช้งาน',
  inactive: 'ไม่ได้ใช้',
  suspended: 'ระงับ',
};

const STATUS_COLOR: Record<Rider['status'], string> = {
  active: '#22c55e',
  inactive: '#6b7280',
  suspended: '#ef4444',
};

const VEHICLE_ICON: Record<string, string> = {
  motorcycle: '🏍️',
  bicycle: '🚲',
  car: '🚗',
};

export function RidersClient({ riders, shopId }: RidersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Rider['status']>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Row Action State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filtered = riders.filter((r) => {
    const matchSearch =
      r.display_name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      (r.telegram_chat_id && r.telegram_chat_id.includes(search));
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const onlineCount = riders.filter((r) => r.is_online).length;
  const activeCount = riders.filter((r) => r.status === 'active').length;

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await createRiderAction({
      shop_id: shopId,
      display_name: displayName,
      phone,
      vehicle_type: vehicleType,
      email,
      password: password || 'rider1234',
      telegram_chat_id: telegramChatId || undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการสร้างบัญชีไรเดอร์');
      return;
    }

    setSuccessMsg(`เพิ่มไรเดอร์ "${displayName}" สำเร็จ พร้อมสร้างบัญชีเข้าสู่ระบบแล้ว`);
    setIsModalOpen(false);
    // Reset Form
    setDisplayName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setTelegramChatId('');
    router.refresh();

    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleToggleStatus = async (riderId: string, currentStatus: Rider['status']) => {
    setActionLoadingId(riderId);
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const res = await updateRiderStatusAction(riderId, newStatus);
    setActionLoadingId(null);

    if (!res.success) {
      alert(`ไม่สามารถปรับสถานะได้: ${res.error}`);
      return;
    }

    router.refresh();
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
            🛵 จัดการไรเดอร์
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            ไรเดอร์ทั้งหมด {riders.length} คน · ออนไลน์ {onlineCount} คน · Active {activeCount} คน
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '0.625rem 1.25rem',
            background: '#ea580c',
            color: 'white',
            borderRadius: '0.75rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)',
          }}
        >
          <Plus size={18} />
          <span>เพิ่มไรเดอร์ใหม่</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.75rem',
          color: '#166534',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon="🟢" label="ออนไลน์ตอนนี้" value={onlineCount} color="#22c55e" />
        <StatCard icon="👤" label="Active ทั้งหมด" value={activeCount} color="#3b82f6" />
        <StatCard
          icon="⭐"
          label="Score เฉลี่ย"
          value={
            riders.length > 0
              ? (riders.reduce((s, r) => s + r.performance_score, 0) / riders.length).toFixed(2)
              : '-'
          }
          color="#f59e0b"
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="ค้นหาชื่อ, เบอร์โทร หรือ Telegram..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            flex: 1,
            minWidth: '200px',
            outline: 'none',
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            background: 'white',
          }}
        >
          <option value="all">สถานะทั้งหมด</option>
          <option value="active">ใช้งาน</option>
          <option value="inactive">ไม่ได้ใช้</option>
          <option value="suspended">ระงับ</option>
        </select>
      </div>

      {/* Rider Table */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#94a3b8',
          background: '#f8fafc',
          borderRadius: '0.75rem',
        }}>
          {search || filterStatus !== 'all' ? 'ไม่พบไรเดอร์ที่ตรงกับเงื่อนไข' : 'ยังไม่มีไรเดอร์ในร้านนี้ คลิก "เพิ่มไรเดอร์ใหม่" เพื่อเริ่มต้น'}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>สถานะการทำงาน</th>
                <th style={thStyle}>ชื่อ-เบอร์โทร</th>
                <th style={thStyle}>ยานพาหนะ</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Telegram</th>
                <th style={thStyle}>บัญชีเข้าสู่ระบบ</th>
                <th style={thStyle}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rider, i) => (
                <tr
                  key={rider.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: rider.is_online ? '#f0fdf4' : 'white',
                  }}
                >
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: rider.is_online ? '#22c55e' : '#d1d5db',
                      marginRight: '0.5rem',
                    }} />
                    <span style={{ fontWeight: rider.is_online ? 600 : 400, color: rider.is_online ? '#166534' : '#64748b' }}>
                      {rider.is_online ? 'ออนไลน์' : 'ออฟไลน์'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{rider.display_name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{rider.phone}</div>
                  </td>
                  <td style={tdStyle}>
                    {VEHICLE_ICON[rider.vehicle_type] ?? '🏍️'} {rider.vehicle_type}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                      ⭐ {rider.performance_score.toFixed(2)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {rider.telegram_chat_id ? (
                      <span style={{ color: '#0284c7', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        ID: {rider.telegram_chat_id}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {rider.auth_user_id ? (
                      <span style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldCheck size={14} /> ผูกแล้ว
                      </span>
                    ) : (
                      <span style={{ color: '#ea580c', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldAlert size={14} /> ยังไม่ผูก
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleToggleStatus(rider.id, rider.status)}
                        disabled={actionLoadingId === rider.id}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: rider.status === 'active' ? '#fee2e2' : '#dcfce7',
                          color: rider.status === 'active' ? '#b91c1c' : '#15803d',
                        }}
                      >
                        {actionLoadingId === rider.id ? (
                          'กำลังโหลด...'
                        ) : rider.status === 'active' ? (
                          'ระงับชั่วคราว'
                        ) : (
                          'เปิดใช้งาน'
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Rider Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 50,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bike className="w-5 h-5 text-amber-600" />
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  เพิ่มไรเดอร์ใหม่
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{
                padding: '0.75rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                color: '#b91c1c',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateRider} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  ชื่อ-นามสกุล ไรเดอร์ *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    required
                    placeholder="เช่น สมชาย ใจดี"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  เบอร์โทรศัพท์ *
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="tel"
                    required
                    placeholder="เช่น 0812345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  ประเภทยานพาหนะ
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '0.75rem' }}
                >
                  <option value="motorcycle">🏍️ รถมอเตอร์ไซค์</option>
                  <option value="bicycle">🚲 จักรยาน</option>
                  <option value="car">🚗 รถยนต์</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  อีเมลสำหรับเข้าสู่ระบบ (/rider/login) *
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="email"
                    required
                    placeholder="เช่น rider1@ranrhan.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  รหัสผ่าน (เว้นว่างไว้จะใช้ "rider1234")
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="password"
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                  Telegram Chat ID (ถ้ามี สำหรับรับแจ้งเตือนบอท)
                </label>
                <div style={{ position: 'relative' }}>
                  <Send size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="เช่น 123456789"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    border: 'none',
                    background: '#ea580c',
                    color: 'white',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  <span>บันทึกและผูกบัญชี</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
  border: '1px solid #cbd5e1',
  borderRadius: '0.5rem',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontWeight: 600,
  color: '#475569',
  fontSize: '0.8rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  color: '#334155',
  verticalAlign: 'middle',
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '0.75rem',
          background: color + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
      </div>
    </div>
  );
}
