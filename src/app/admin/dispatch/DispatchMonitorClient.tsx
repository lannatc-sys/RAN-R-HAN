'use client';

import { useState, useTransition } from 'react';
import { dispatchOrderAction } from '@/app/actions/dispatch';

interface ActiveOrder {
  id: string;
  order_no: string;
  dispatch_status: string;
  delivery_address: string | null;
  created_at: string;
  assigned_rider_id: string | null;
  riders?: { display_name: string; phone: string }[] | null;
}

interface RecentOffer {
  id: string;
  order_id: string;
  status: string;
  dispatch_round: number;
  offered_at: string;
  responded_at: string | null;
  timeout_at: string | null;
  riders?: { display_name: string; phone: string }[] | null;
}

interface OnlineRider {
  rider_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  riders?: { display_name: string; phone: string; status: string }[] | null;
}

interface DispatchMonitorClientProps {
  shopId: string;
  activeOrders: ActiveOrder[];
  recentOffers: RecentOffer[];
  onlineRiders: OnlineRider[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  dispatching: '#3b82f6',
  assigned: '#8b5cf6',
  in_transit: '#06b6d4',
  delivered: '#22c55e',
  failed: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอ Dispatch',
  dispatching: 'กำลัง Dispatch...',
  assigned: 'Rider รับงานแล้ว',
  in_transit: 'กำลังส่ง',
  delivered: 'ส่งแล้ว',
  failed: 'ล้มเหลว',
};

const OFFER_STATUS_COLOR: Record<string, string> = {
  offered: '#3b82f6',
  accepted: '#22c55e',
  rejected: '#ef4444',
  timed_out: '#f59e0b',
};

export function DispatchMonitorClient({
  shopId,
  activeOrders,
  recentOffers,
  onlineRiders,
}: DispatchMonitorClientProps) {
  const [dispatchResult, setDispatchResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDispatch = (orderId: string) => {
    setDispatchResult(null);
    startTransition(async () => {
      const result = await dispatchOrderAction(orderId);
      if (result.success) {
        setDispatchResult(`✅ ส่ง Offer ให้ ${result.rider_name} แล้ว`);
      } else {
        setDispatchResult(`❌ ${result.error}`);
      }
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          📡 Dispatch Monitor
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          ไรเดอร์ออนไลน์ {onlineRiders.length} คน · Order ที่รอ/กำลังส่ง {activeOrders.length} รายการ
        </p>
      </div>

      {dispatchResult && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem',
          background: dispatchResult.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          color: dispatchResult.startsWith('✅') ? '#166534' : '#991b1b',
          border: `1px solid ${dispatchResult.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
          fontSize: '0.875rem',
        }}>
          {dispatchResult}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main: Active Orders */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
            🚀 Orders ที่กำลัง Dispatch
          </h2>
          {activeOrders.length === 0 ? (
            <EmptyState message="ไม่มี Order ที่รอ Dispatch" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activeOrders.map((order) => (
                <div key={order.id} style={{
                  background: 'white', borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0', padding: '1rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        #{order.order_no}
                      </div>
                      {order.delivery_address && (
                        <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          📍 {order.delivery_address}
                        </div>
                      )}
                      {order.riders && Array.isArray(order.riders) && order.riders[0] && (
                        <div style={{ color: '#6366f1', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                          🛵 {order.riders[0].display_name} · {order.riders[0].phone}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem',
                        background: (STATUS_COLOR[order.dispatch_status] ?? '#94a3b8') + '20',
                        color: STATUS_COLOR[order.dispatch_status] ?? '#94a3b8',
                        fontWeight: 600, display: 'inline-block', marginBottom: '0.5rem',
                      }}>
                        {STATUS_LABEL[order.dispatch_status] ?? order.dispatch_status}
                      </span>
                      {(order.dispatch_status === 'pending' || order.dispatch_status === 'failed') && (
                        <div>
                          <button
                            id={`dispatch-btn-${order.id}`}
                            onClick={() => handleDispatch(order.id)}
                            disabled={isPending}
                            style={{
                              padding: '0.4rem 0.875rem', borderRadius: '0.5rem',
                              background: isPending ? '#94a3b8' : '#3b82f6', color: 'white',
                              border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem', fontWeight: 600,
                            }}
                          >
                            {isPending ? 'กำลัง...' : '📡 Dispatch'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Offers */}
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', color: '#374151' }}>
            📋 Offer ล่าสุด
          </h2>
          {recentOffers.length === 0 ? (
            <EmptyState message="ยังไม่มี Offer" />
          ) : (
            <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={thStyle}>ไรเดอร์</th>
                    <th style={thStyle}>รอบ</th>
                    <th style={thStyle}>สถานะ</th>
                    <th style={thStyle}>เวลา Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOffers.map((offer, i) => (
                    <tr key={offer.id} style={{ borderBottom: i < recentOffers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={tdStyle}>
                        {offer.riders?.[0]?.display_name ?? 'N/A'}
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          {offer.riders?.[0]?.phone}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>รอบ {offer.dispatch_round}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem',
                          background: (OFFER_STATUS_COLOR[offer.status] ?? '#94a3b8') + '20',
                          color: OFFER_STATUS_COLOR[offer.status] ?? '#94a3b8', fontWeight: 600,
                        }}>
                          {offer.status}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#94a3b8' }}>
                        {new Date(offer.offered_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar: Online Riders */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
            🟢 ไรเดอร์ออนไลน์
          </h2>
          {onlineRiders.length === 0 ? (
            <EmptyState message="ไม่มีไรเดอร์ออนไลน์" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {onlineRiders.map((r) => (
                <div key={r.rider_id} style={{
                  background: 'white', borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0', padding: '0.875rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#22c55e', display: 'inline-block', flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                        {r.riders?.[0]?.display_name ?? 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        อัปเดต: {new Date(r.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1.5rem' }}>
        🔄 กด F5 เพื่อรีเฟรชข้อมูล · Shop ID: {shopId}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '2rem', color: '#94a3b8',
      background: '#f8fafc', borderRadius: '0.75rem', fontSize: '0.875rem',
    }}>
      {message}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem', textAlign: 'left',
  fontWeight: 600, color: '#475569',
};

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.875rem', color: '#334155',
};
