import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ==============================================================================
// Rider System Unit Tests — Phase 1
// ทดสอบ Pure Logic ที่ไม่ต้องการ DB Connection
// ==============================================================================

// ── Dispatch Score Logic ──────────────────────────────────────────────────────

interface CandidateRider {
  id: string;
  display_name: string;
  performance_score: number;
  lat: number;
  lng: number;
  distance_m: number;
}

function calculateScore(rider: CandidateRider): number {
  const distanceScore = rider.distance_m > 0 ? (10000 / rider.distance_m) : 100;
  const performanceScore = rider.performance_score;
  return parseFloat((distanceScore + performanceScore).toFixed(4));
}

function scoreCandidates(candidates: CandidateRider[]): CandidateRider[] {
  return [...candidates].sort((a, b) => calculateScore(b) - calculateScore(a));
}

describe('🛵 Rider Dispatch Engine Tests', () => {
  describe('Dispatch Score — calculateScore()', () => {
    it('ไรเดอร์ที่ใกล้กว่าได้ score สูงกว่า (performance เท่ากัน)', () => {
      const near: CandidateRider = {
        id: '1', display_name: 'A', performance_score: 4.0, lat: 0, lng: 0, distance_m: 500,
      };
      const far: CandidateRider = {
        id: '2', display_name: 'B', performance_score: 4.0, lat: 0, lng: 0, distance_m: 2000,
      };
      assert.ok(calculateScore(near) > calculateScore(far), 'ไรเดอร์ใกล้ต้องได้ score สูงกว่า');
    });

    it('ไรเดอร์ที่มี performance สูงกว่าได้ score สูงกว่า (ระยะทางเท่ากัน)', () => {
      const highPerf: CandidateRider = {
        id: '1', display_name: 'A', performance_score: 5.0, lat: 0, lng: 0, distance_m: 1000,
      };
      const lowPerf: CandidateRider = {
        id: '2', display_name: 'B', performance_score: 2.0, lat: 0, lng: 0, distance_m: 1000,
      };
      assert.ok(calculateScore(highPerf) > calculateScore(lowPerf));
    });

    it('distance_m = 0 ไม่ทำให้ NaN หรือ Infinity', () => {
      const rider: CandidateRider = {
        id: '1', display_name: 'A', performance_score: 5.0, lat: 0, lng: 0, distance_m: 0,
      };
      const score = calculateScore(rider);
      assert.ok(isFinite(score), `score ต้องเป็น finite number แต่ได้ ${score}`);
      assert.ok(!isNaN(score), 'score ต้องไม่เป็น NaN');
    });
  });

  describe('Dispatch Score — scoreCandidates()', () => {
    it('เรียง candidates จาก score สูงไปต่ำ', () => {
      const candidates: CandidateRider[] = [
        { id: '3', display_name: 'C', performance_score: 3.0, lat: 0, lng: 0, distance_m: 3000 },
        { id: '1', display_name: 'A', performance_score: 5.0, lat: 0, lng: 0, distance_m: 500 },
        { id: '2', display_name: 'B', performance_score: 4.0, lat: 0, lng: 0, distance_m: 1000 },
      ];
      const sorted = scoreCandidates(candidates);
      assert.equal(sorted[0].id, '1', 'คนแรกต้องใกล้ที่สุดและ performance ดีที่สุด');
      assert.equal(sorted[sorted.length - 1].id, '3', 'คนสุดท้ายต้องไกลที่สุด');
    });

    it('ไม่ mutate array ต้นฉบับ', () => {
      const original: CandidateRider[] = [
        { id: '2', display_name: 'B', performance_score: 4.0, lat: 0, lng: 0, distance_m: 1000 },
        { id: '1', display_name: 'A', performance_score: 5.0, lat: 0, lng: 0, distance_m: 500 },
      ];
      scoreCandidates(original);
      assert.equal(original[0].id, '2', 'Array ต้นฉบับต้องไม่ถูกเปลี่ยน');
    });

    it('รับ candidates ว่างได้โดยไม่ throw', () => {
      assert.doesNotThrow(() => scoreCandidates([]));
      assert.deepEqual(scoreCandidates([]), []);
    });
  });
});

// ── Work Session State Logic ──────────────────────────────────────────────────

type SessionStatus = 'open' | 'closed';

function canStartWork(existingStatus: SessionStatus | null): { allowed: boolean; reason?: string } {
  if (existingStatus === 'open') {
    return { allowed: false, reason: 'มี session เปิดอยู่แล้ว' };
  }
  return { allowed: true };
}

function canCloseWork(existingStatus: SessionStatus | null): { allowed: boolean; reason?: string } {
  if (!existingStatus || existingStatus === 'closed') {
    return { allowed: false, reason: 'ไม่มี session เปิดอยู่' };
  }
  return { allowed: true };
}

describe('🏁 Work Session State Tests', () => {
  it('canStartWork: อนุญาตเมื่อไม่มี session', () => {
    assert.equal(canStartWork(null).allowed, true);
  });

  it('canStartWork: ปฏิเสธเมื่อมี session open อยู่แล้ว', () => {
    const result = canStartWork('open');
    assert.equal(result.allowed, false);
    assert.ok(result.reason, 'ต้องมี reason');
  });

  it('canStartWork: อนุญาตเมื่อ session ปิดแล้ว (เปิดใหม่ได้)', () => {
    assert.equal(canStartWork('closed').allowed, true);
  });

  it('canCloseWork: อนุญาตเมื่อมี session open', () => {
    assert.equal(canCloseWork('open').allowed, true);
  });

  it('canCloseWork: ปฏิเสธเมื่อไม่มี session', () => {
    const result = canCloseWork(null);
    assert.equal(result.allowed, false);
    assert.ok(result.reason);
  });

  it('canCloseWork: ปฏิเสธเมื่อ session ปิดไปแล้ว', () => {
    assert.equal(canCloseWork('closed').allowed, false);
  });
});

// ── Dispatch Round Logic ──────────────────────────────────────────────────────

const MAX_DISPATCH_ROUNDS = 3;

function shouldContinueDispatch(currentRound: number): boolean {
  return currentRound <= MAX_DISPATCH_ROUNDS;
}

describe('🔄 Dispatch Round Logic Tests', () => {
  it('รอบ 1, 2, 3 ควร continue', () => {
    assert.equal(shouldContinueDispatch(1), true);
    assert.equal(shouldContinueDispatch(2), true);
    assert.equal(shouldContinueDispatch(3), true);
  });

  it('รอบ 4+ ควรหยุด', () => {
    assert.equal(shouldContinueDispatch(4), false);
    assert.equal(shouldContinueDispatch(10), false);
  });
});

// ── GPS Validation ────────────────────────────────────────────────────────────

function validateGPS(lat: number, lng: number): { valid: boolean; error?: string } {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, error: 'lat/lng ต้องเป็น number' };
  }
  if (lat < -90 || lat > 90) return { valid: false, error: 'lat ต้องอยู่ระหว่าง -90 ถึง 90' };
  if (lng < -180 || lng > 180) return { valid: false, error: 'lng ต้องอยู่ระหว่าง -180 ถึง 180' };
  return { valid: true };
}

describe('📍 GPS Validation Tests', () => {
  it('พิกัดแม่ฮ่องสอนต้องผ่าน', () => {
    assert.equal(validateGPS(19.3005, 97.9678).valid, true);
  });

  it('lat เกิน 90 ต้องไม่ผ่าน', () => {
    assert.equal(validateGPS(91, 100).valid, false);
  });

  it('lng เกิน 180 ต้องไม่ผ่าน', () => {
    assert.equal(validateGPS(19, 181).valid, false);
  });

  it('พิกัด (0, 0) ต้องผ่าน (Null Island — ไม่ใช่ invalid)', () => {
    assert.equal(validateGPS(0, 0).valid, true);
  });

  it('พิกัดติดลบ (ซีกโลกใต้/ตะวันตก) ต้องผ่าน', () => {
    assert.equal(validateGPS(-33.8688, 151.2093).valid, true); // Sydney
  });
});

// ── Offer Timeout Check ───────────────────────────────────────────────────────

function isOfferExpired(timeoutAt: string): boolean {
  return new Date() > new Date(timeoutAt);
}

describe('⏱️ Offer Timeout Tests', () => {
  it('offer ที่ timeout_at อยู่ในอนาคตต้องไม่ expired', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.equal(isOfferExpired(future), false);
  });

  it('offer ที่ timeout_at อยู่ในอดีตต้อง expired', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(isOfferExpired(past), true);
  });
});
