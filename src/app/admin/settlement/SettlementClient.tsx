'use client';

interface Settlement {
  id: string;
  settlement_date: string;
  status: string;
  total_orders: number;
  total_delivery_fee: number;
  total_rider_payout: number;
  total_rider_pool: number;
  exception_count: number;
  approved_by: string | null;
  approved_at: string | null;
  admin_note: string | null;
}

interface SettlementClientProps {
  shopId: string;
  settlements: Settlement[];
  todaySettlement: Settlement | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  reviewing: '#f59e0b',
  approved: '#3b82f6',
  executing: '#8b5cf6',
  completed: '#22c55e',
  exception: '#ef4444',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  reviewing: 'กำลัง Review',
  approved: 'อนุมัติแล้ว',
  executing: 'กำลังโอน',
  completed: 'เสร็จสิ้น',
  exception: '⚠️ Exception',
};

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SettlementClient({ shopId, settlements, todaySettlement }: SettlementClientProps) {
  const totalCompleted = settlements.filter((s) => s.status === 'completed').length;
  const totalException = settlements.filter((s) => s.status === 'exception').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          💰 Daily Settlement
        </h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.875rem' }}>
          ประวัติการจ่ายเงิน 30 วัน · สำเร็จ {totalCompleted} รอบ · Exception {totalException} รอบ
        </p>
      </div>

      {/* Today's Settlement Banner */}
      {todaySettlement ? (
        <TodayCard settlement={todaySettlement} />
      ) : (
        <div style={{
          background: '#fffbeb', borderRadius: '0.75rem', padding: '1rem 1.25rem',
          border: '1px solid #fde68a', color: '#92400e', fontSize: '0.875rem',
          marginBottom: '1.5rem',
        }}>
          ⚠️ ยังไม่มี Settlement สำหรับวันนี้ — ระบบจะสร้าง Draft อัตโนมัติเมื่อสิ้นวัน
        </div>
      )}

      {/* Settlement History */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
        📅 ประวัติ Settlement
      </h2>

      {settlements.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#94a3b8',
          background: '#f8fafc', borderRadius: '0.75rem',
        }}>
          ยังไม่มีประวัติ Settlement
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>วันที่</th>
                <th style={thStyle}>Order</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Delivery Fee</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Rider Payout</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Rider Pool</th>
                <th style={thStyle}>สถานะ</th>
                <th style={thStyle}>Exception</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s, i) => (
                <tr key={s.id} style={{
                  borderBottom: i < settlements.length - 1 ? '1px solid #f1f5f9' : 'none',
                  background: s.status === 'exception' ? '#fff5f5' : 'white',
                }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>
                      {new Date(s.settlement_date).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: '2-digit',
                      })}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{s.total_orders}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                    ฿{fmt(s.total_delivery_fee)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#22c55e' }}>
                    ฿{fmt(s.total_rider_payout)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', color: '#6366f1' }}>
                    ฿{fmt(s.total_rider_pool)}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem',
                      background: (STATUS_COLOR[s.status] ?? '#94a3b8') + '20',
                      color: STATUS_COLOR[s.status] ?? '#94a3b8', fontWeight: 600,
                    }}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: s.exception_count > 0 ? '#ef4444' : '#94a3b8' }}>
                    {s.exception_count > 0 ? `⚠️ ${s.exception_count} รายการ` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1rem' }}>
        💡 ฟีเจอร์ Approve + ดู Line Items กำลังพัฒนา
        &nbsp;· Shop ID: {shopId}
      </p>
    </div>
  );
}

function TodayCard({ settlement }: { settlement: Settlement }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b, #334155)',
      borderRadius: '0.875rem', padding: '1.25rem 1.5rem',
      marginBottom: '1.5rem', color: 'white',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.25rem' }}>
            Settlement วันนี้ · {new Date(settlement.settlement_date).toLocaleDateString('th-TH', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            ฿{(settlement.total_delivery_fee).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            Delivery Fee รวม · {settlement.total_orders} Order
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Rider Payout</div>
            <div style={{ fontWeight: 700, color: '#86efac' }}>
              ฿{(settlement.total_rider_payout).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Rider Pool</div>
            <div style={{ fontWeight: 700, color: '#c4b5fd' }}>
              ฿{(settlement.total_rider_pool).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>สถานะ</div>
            <div style={{ fontWeight: 700, color: STATUS_COLOR[settlement.status] ?? '#fff' }}>
              {STATUS_LABEL[settlement.status] ?? settlement.status}
            </div>
          </div>
        </div>
      </div>
      {settlement.exception_count > 0 && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem',
          background: 'rgba(239,68,68,0.2)', borderRadius: '0.5rem',
          fontSize: '0.8rem', color: '#fca5a5',
        }}>
          ⚠️ {settlement.exception_count} รายการรอ Review
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', textAlign: 'left',
  fontWeight: 600, color: '#475569', fontSize: '0.8rem',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', color: '#334155', verticalAlign: 'middle',
};
