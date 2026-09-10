'use client';

import { useState } from 'react';

interface Rider {
  id: string;
  display_name: string;
  phone: string;
  vehicle_type: string;
  status: 'active' | 'inactive' | 'suspended';
  performance_score: number;
  created_at: string;
  auth_user_id: string | null;
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
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | Rider['status']>('all');

  const filtered = riders.filter((r) => {
    const matchSearch =
      r.display_name.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search);
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const onlineCount = riders.filter((r) => r.is_online).length;
  const activeCount = riders.filter((r) => r.status === 'active').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          🛵 จัดการไรเดอร์
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          ไรเดอร์ทั้งหมด {riders.length} คน · ออนไลน์ {onlineCount} คน · Active {activeCount} คน
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon="🟢" label="ออนไลน์ตอนนี้" value={onlineCount} color="#22c55e" />
        <StatCard icon="👤" label="Active ทั้งหมด" value={activeCount} color="#3b82f6" />
        <StatCard icon="⭐" label="Score เฉลี่ย" value={
          riders.length > 0
            ? (riders.reduce((s, r) => s + r.performance_score, 0) / riders.length).toFixed(2)
            : '-'
        } color="#f59e0b" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
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
          textAlign: 'center', padding: '3rem', color: '#94a3b8',
          background: '#f8fafc', borderRadius: '0.75rem',
        }}>
          {search || filterStatus !== 'all' ? 'ไม่พบไรเดอร์ที่ตรงกับเงื่อนไข' : 'ยังไม่มีไรเดอร์ในร้านนี้'}
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>สถานะ</th>
                <th style={thStyle}>ชื่อ-เบอร์</th>
                <th style={thStyle}>ยานพาหนะ</th>
                <th style={thStyle}>Performance</th>
                <th style={thStyle}>สถานะบัญชี</th>
                <th style={thStyle}>Auth</th>
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
                      display: 'inline-block', width: '10px', height: '10px',
                      borderRadius: '50%', background: rider.is_online ? '#22c55e' : '#d1d5db',
                      marginRight: '0.5rem',
                    }} />
                    {rider.is_online ? 'ออนไลน์' : 'ออฟไลน์'}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{rider.display_name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{rider.phone}</div>
                  </td>
                  <td style={tdStyle}>
                    {VEHICLE_ICON[rider.vehicle_type] ?? '🚗'} {rider.vehicle_type}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                      ⭐ {rider.performance_score.toFixed(2)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem',
                      background: STATUS_COLOR[rider.status] + '20',
                      color: STATUS_COLOR[rider.status],
                      fontWeight: 600,
                    }}>
                      {STATUS_LABEL[rider.status]}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {rider.auth_user_id ? (
                      <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>✓ เชื่อมแล้ว</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>ยังไม่ Invite</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note */}
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1rem' }}>
        💡 ฟีเจอร์เพิ่ม/แก้ไข/ระงับไรเดอร์กำลังพัฒนา (Phase 1d)
        &nbsp;· Shop ID: {shopId}
      </p>
    </div>
  );
}

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
  icon, label, value, color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '0.75rem', padding: '1.25rem',
      border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '0.75rem',
        background: color + '15', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '1.5rem',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
      </div>
    </div>
  );
}
