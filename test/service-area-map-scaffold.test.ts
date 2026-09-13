import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isClosedRing,
  polygonDraftToGeoJson,
  toCounterClockwise,
  LngLat,
  PolygonDraft,
} from '../src/components/service-area-map/types';
import {
  DEMO_CUSTOMER_POLYGON_DRAFT,
  DEMO_RIDER_POLYGON_DRAFT,
  DEMO_EMPTY_CUSTOMER_DRAFT,
} from '../src/components/service-area-map/fixtures';

const SCAFFOLD_DIR = path.join(__dirname, '..', 'src', 'components', 'service-area-map');

/** Every .ts/.tsx file under a directory, including subdirectories. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}
const APP_DIR = path.join(__dirname, '..', 'src', 'app');

// Forbidden import / API patterns in the isolated UI scaffold
const FORBIDDEN_PATTERNS = [
  { pattern: /@supabase\//, name: '@supabase package import' },
  { pattern: /@\/lib\/supabase/, name: 'supabase client import' },
  { pattern: /\bcreateClient\b/, name: 'createClient invocation' },
  { pattern: /\bcreateAdminClient\b/, name: 'createAdminClient invocation' },
  { pattern: /actions\/(order|rider|settings|delivery|menu|auth|superadmin|legal)/, name: 'Server Action import' },
  { pattern: /\bfetch\s*\(/, name: 'fetch() network request' },
  { pattern: /navigator\.geolocation/, name: 'geolocation API' },
  { pattern: /https?:\/\/[a-zA-Z0-9.-]+\/tiles?/, name: 'map tile external URL' },
];

describe('Service Area Map UI Scaffold — Contract & Isolation Guards', () => {
  describe('1. Contract & Geometry Validation', () => {
    it('isClosedRing properly validates ring closure', () => {
      const openCoords: LngLat[] = [
        [97.962, 19.298],
        [97.973, 19.298],
        [97.967, 19.309],
      ];
      assert.equal(isClosedRing(openCoords), false, 'Open polygon with 3 points must not be closed');

      const nonClosingCoords: LngLat[] = [
        [97.962, 19.298],
        [97.973, 19.298],
        [97.967, 19.309],
        [97.965, 19.300], // 4th point does not match 1st point
      ];
      assert.equal(isClosedRing(nonClosingCoords), false, 'Ring where first != last must not be closed');

      const closedCoords: LngLat[] = [
        [97.962, 19.298],
        [97.973, 19.298],
        [97.967, 19.309],
        [97.962, 19.298], // identical to first point
      ];
      assert.equal(isClosedRing(closedCoords), true, 'Ring where first == last must be closed');
    });

    it('polygonDraftToGeoJson emits valid GeoJSON Polygon for closed draft and null for open draft', () => {
      const geoJson = polygonDraftToGeoJson(DEMO_CUSTOMER_POLYGON_DRAFT);
      assert.ok(geoJson, 'Closed draft must serialize to GeoJSON');
      assert.equal(geoJson?.type, 'Polygon');
      assert.equal(geoJson?.coordinates.length, 1);
      assert.equal(geoJson?.coordinates[0].length, 4);
      // Coordinates order must be [longitude, latitude]
      const firstVertex = geoJson?.coordinates[0][0];
      assert.ok(firstVertex[0] > 90, 'Index 0 must be longitude (WGS84 Mae Hong Son ~97.9)');
      assert.ok(firstVertex[1] < 30, 'Index 1 must be latitude (WGS84 Mae Hong Son ~19.3)');

      // Open draft must return null
      assert.equal(polygonDraftToGeoJson(DEMO_RIDER_POLYGON_DRAFT), null);
      assert.equal(polygonDraftToGeoJson(DEMO_EMPTY_CUSTOMER_DRAFT), null);
    });

    it('a clockwise ring is normalised counter-clockwise before serialisation', () => {
      // Drawn clockwise, which is what a right-handed person tends to do.
      const clockwise: LngLat[] = [
        [97.962, 19.298],
        [97.9675, 19.309],
        [97.973, 19.298],
        [97.962, 19.298],
      ];

      const shoelace = (ring: LngLat[]) => {
        let sum = 0;
        for (let i = 0; i < ring.length - 1; i++) {
          sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
        }
        return sum;
      };

      assert.ok(shoelace(clockwise) > 0, 'fixture for this test must start clockwise');
      assert.ok(
        shoelace(toCounterClockwise(clockwise)) < 0,
        'toCounterClockwise must flip a clockwise ring'
      );

      const draft: PolygonDraft = {
        id: 'cw-draft',
        kind: 'customer',
        coordinates: clockwise,
        status: 'closed',
        fallbackRadiusMeters: 5000,
        label: 'clockwise draft',
      };

      const geoJson = polygonDraftToGeoJson(draft);
      assert.ok(geoJson, 'a closed clockwise draft still serialises');
      assert.ok(
        shoelace(geoJson!.coordinates[0]) < 0,
        'a clockwise ring reaching geography(Polygon) would describe the whole globe ' +
          'minus the shape and trip SERVICE_AREA_POLYGON_TOO_LARGE'
      );
      assert.ok(
        isClosedRing(geoJson!.coordinates[0]),
        'reversing a ring must keep it closed'
      );
    });

    it('an already counter-clockwise ring is left untouched', () => {
      const geoJson = polygonDraftToGeoJson(DEMO_CUSTOMER_POLYGON_DRAFT);
      assert.deepEqual(
        geoJson?.coordinates[0],
        DEMO_CUSTOMER_POLYGON_DRAFT.coordinates,
        'normalising must not reorder a ring that is already correct'
      );
    });

    it('all coordinates in demo fixtures adhere to [lng, lat] GeoJSON bounds', () => {
      const allDrafts = [DEMO_CUSTOMER_POLYGON_DRAFT, DEMO_RIDER_POLYGON_DRAFT];
      for (const draft of allDrafts) {
        for (const [lng, lat] of draft.coordinates) {
          assert.ok(lng >= -180 && lng <= 180, `Longitude ${lng} out of bounds`);
          assert.ok(lat >= -90 && lat <= 90, `Latitude ${lat} out of bounds`);
        }
      }
    });
  });

  describe('2. Isolation & Anti-Contamination Guards', () => {
    it('proves that the violation detector catches forbidden imports (Red-Green Proof)', () => {
      const badContent1 = "import { createAdminClient } from '@/lib/supabase/admin';";
      const badContent2 = "fetch('https://api.example.com/tiles');";
      const badContent3 = "import { updateShopGeoAction } from '@/app/actions/settings';";

      const testCheck = (content: string) => {
        return FORBIDDEN_PATTERNS.some((p) => p.pattern.test(content));
      };

      assert.equal(testCheck(badContent1), true, 'Detector must catch supabase import');
      assert.equal(testCheck(badContent2), true, 'Detector must catch fetch call');
      assert.equal(testCheck(badContent3), true, 'Detector must catch Server Action import');
    });

    it('scaffold directory contains NO forbidden imports, fetch calls, or DB clients', () => {
      // Recursive on purpose: a subdirectory added later must not slip past the gate.
      const files = collectSourceFiles(SCAFFOLD_DIR);
      assert.ok(files.length > 0, 'Scaffold directory must have files');

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relative = path.relative(SCAFFOLD_DIR, filePath);

        for (const { pattern, name } of FORBIDDEN_PATTERNS) {
          const match = pattern.test(content);
          assert.equal(
            match,
            false,
            `Forbidden pattern '${name}' found in scaffold file: ${relative}`
          );
        }
      }
    });

    it('the scaffold scan reaches files inside subdirectories', () => {
      const probeDir = path.join(SCAFFOLD_DIR, '__scan_probe__');
      const probeFile = path.join(probeDir, 'nested.ts');
      fs.mkdirSync(probeDir, { recursive: true });
      fs.writeFileSync(probeFile, 'export const x = 1;', 'utf-8');
      try {
        const found = collectSourceFiles(SCAFFOLD_DIR);
        assert.ok(
          found.includes(probeFile),
          'A file in a subdirectory must be collected, otherwise the gate has a blind spot'
        );
      } finally {
        fs.rmSync(probeDir, { recursive: true, force: true });
      }
    });

    it('scaffold directory does NOT contain any page.tsx route', () => {
      const files = fs.readdirSync(SCAFFOLD_DIR);
      const pageFile = files.find((f) => f.toLowerCase() === 'page.tsx' || f.toLowerCase() === 'page.ts');
      assert.equal(pageFile, undefined, 'Scaffold must NOT define any Next.js page.tsx');
    });

    it('production ServiceAreaSettingsClient.tsx is untouched and does NOT import scaffold', () => {
      const clientSettingsPath = path.join(
        APP_DIR,
        'admin',
        'service-area',
        'ServiceAreaSettingsClient.tsx'
      );
      assert.ok(fs.existsSync(clientSettingsPath), 'ServiceAreaSettingsClient.tsx must exist');
      const content = fs.readFileSync(clientSettingsPath, 'utf-8');
      assert.equal(
        content.includes('service-area-map'),
        false,
        'Production ServiceAreaSettingsClient.tsx must NOT import service-area-map scaffold'
      );
    });

    it('only the approved superadmin page imports the scaffold', () => {
      // The editor is reachable at one address and nowhere else. Widening this
      // list is a decision, not a detail: anything under /admin or the customer
      // routes would expose an editor that cannot save and is not yet reviewed.
      const APPROVED = [
        path.join('superadmin', 'service-area-map', 'page.tsx'),
        path.join('superadmin', 'service-area-map', 'ServiceAreaMapClient.tsx'),
      ];

      const offenders: string[] = [];
      function scanDir(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (!content.includes('service-area-map')) continue;
            const relative = path.relative(APP_DIR, fullPath);
            if (!APPROVED.includes(relative)) offenders.push(relative);
          }
        }
      }
      scanDir(APP_DIR);

      assert.deepEqual(
        offenders,
        [],
        `Only ${APPROVED.join(' and ')} may import the scaffold`
      );
    });

    it('the approved page is the one that exists, and it sits under superadmin', () => {
      const pagePath = path.join(APP_DIR, 'superadmin', 'service-area-map', 'page.tsx');
      assert.ok(fs.existsSync(pagePath), 'the approved superadmin page must exist');

      // Its protection is the layout guard, not the address. Assert the guard is
      // still in place rather than trusting the route to stay unguessable.
      const layout = fs.readFileSync(
        path.join(APP_DIR, 'superadmin', 'layout.tsx'),
        'utf-8'
      );
      assert.ok(
        layout.includes('checkIsSuperadmin'),
        'superadmin layout must still gate every page beneath it'
      );
    });

    it('the scaffold itself stays free of map libraries and tile URLs', () => {
      // Leaflet lives in the page layer, injected through renderCanvas, so the
      // scaffold remains renderable offline and in tests.
      for (const filePath of collectSourceFiles(SCAFFOLD_DIR)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        assert.equal(
          /from '.*leaflet|require\('leaflet/.test(content),
          false,
          `${path.relative(SCAFFOLD_DIR, filePath)} must not import leaflet directly`
        );
      }
    });
  });
});
