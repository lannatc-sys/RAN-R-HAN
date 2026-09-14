/**
 * Service Area Map UI Scaffold — Demo Fixtures
 *
 * NOTE: Mock data for visual evaluation and contract validation only.
 * Contains NO real shop IDs, NO real shop coordinates, and NO private data.
 */

import { PolygonDraft, ServiceAreaMapEditorState } from './types';

/**
 * Synthetic demonstration polygon for Customer Delivery Area.
 * Forms a closed linear ring (4 coordinates: 3 distinct vertices + 1 closing vertex equal to first).
 * Order is strictly [longitude, latitude].
 */
export const DEMO_CUSTOMER_POLYGON_DRAFT: PolygonDraft = {
  id: 'demo-customer-polygon-001',
  kind: 'customer',
  label: 'เขตส่งอาหารลูกค้า (Customer Delivery Zone)',
  coordinates: [
    [97.9620, 19.2980], // Vertex 1 [lng, lat]
    [97.9730, 19.2980], // Vertex 2
    [97.9675, 19.3090], // Vertex 3
    [97.9620, 19.2980], // Closing vertex (identical to Vertex 1)
  ],
  status: 'closed',
  fallbackRadiusMeters: 5000,
  updatedAt: '2026-09-13T12:00:00.000Z',
};

/**
 * Synthetic demonstration polygon for Rider Operational Area.
 * In 'drawing' state with 3 open points (not closed yet).
 */
export const DEMO_RIDER_POLYGON_DRAFT: PolygonDraft = {
  id: 'demo-rider-polygon-002',
  kind: 'rider',
  label: 'พื้นที่ปฏิบัติงานไรเดอร์ (Rider Service Zone)',
  coordinates: [
    [97.9550, 19.2900], // Point 1 [lng, lat]
    [97.9800, 19.2900], // Point 2
    [97.9700, 19.3150], // Point 3
  ],
  status: 'drawing',
  fallbackRadiusMeters: 8000,
  updatedAt: '2026-09-13T12:05:00.000Z',
};

/**
 * Synthetic empty polygon draft.
 */
export const DEMO_EMPTY_CUSTOMER_DRAFT: PolygonDraft = {
  id: 'demo-empty-customer-003',
  kind: 'customer',
  label: 'เขตส่งอาหารลูกค้า (ยังไม่กำหนด)',
  coordinates: [],
  status: 'empty',
  fallbackRadiusMeters: 5000,
};

/**
 * Initial demo editor state for scaffold preview.
 */
export const DEMO_INITIAL_EDITOR_STATE: ServiceAreaMapEditorState = {
  activeAreaKind: 'customer',
  customerDraft: DEMO_CUSTOMER_POLYGON_DRAFT,
  riderDraft: DEMO_RIDER_POLYGON_DRAFT,
  readOnly: false,
};
