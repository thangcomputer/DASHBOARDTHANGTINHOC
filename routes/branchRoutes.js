/**
 * branchRoutes.js — CRUD Chi nhánh
 *
 * GET    /api/branches          — Danh sách (public, để form đăng ký dùng)
 * POST   /api/branches          — Thêm chi nhánh (manage_staff)
 * PUT    /api/branches/:id      — Sửa chi nhánh (manage_staff)
 * DELETE /api/branches/:id      — Soft-disable chi nhánh (manage_staff)
 *
 * Phase 7.14 — Controlled cutover for /api/branches ONLY.
 * Flow: (auth if admin) → policyShadowBranch → branchesCutoverGate → handler
 */
const express = require('express');
const Branch  = require('../models/Branch');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowBranch } = require('../middleware/policyShadowBranch');
const { branchesCutoverGate } = require('../middleware/branchesCutoverGate');
const cache = require('../utils/cache');

const router = express.Router();

const adminGuard = (action) => [
  authMiddleware,
  policyShadowBranch(action),
  branchesCutoverGate(action),
];

const BRANCH_ACTIVE_KEY = 'branches:active';
const BRANCH_ALL_KEY = 'branches:all';
const BRANCH_TTL = 300;

async function invalidateBranchCache() {
  await cache.delByPrefix('branches:');
}

async function tenantBranchQuery(req) {
  const tenantId = req.headers['x-tenant-id'] || req.query.tenant_id;
  if (tenantId && tenantId !== 'all') return { tenantId };
  return {};
}

// ── GET /api/branches ─────────────────────────────────────────────────────────
router.get('/', [
  policyShadowBranch('list_public'),
  branchesCutoverGate('list_public'),
], async (req, res) => {
  try {
    const tq = await tenantBranchQuery(req);
    const cacheKey = BRANCH_ACTIVE_KEY + ':' + (tq.tenantId || 'all');
    const branches = await cache.wrap(cacheKey, BRANCH_TTL, async () => {
      return Branch.find({ isActive: true, ...tq }).sort({ name: 1 }).lean();
    });
    // Cache 5 phút — danh sách chi nhánh ít thay đổi
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res.json({ success: true, count: branches.length, data: branches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/branches/all — kể cả inactive (cho admin UI) ────────────────────
router.get('/all', adminGuard('list_all'), async (req, res) => {
  try {
    const tq = await tenantBranchQuery(req);
    const cacheKey = BRANCH_ALL_KEY + ':' + (tq.tenantId || 'all');
    const branches = await cache.wrap(cacheKey, BRANCH_TTL, async () => {
      return Branch.find(tq).sort({ createdAt: -1 }).lean();
    });
    return res.json({ success: true, count: branches.length, data: branches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/branches ────────────────────────────────────────────────────────
router.post('/', adminGuard('create'), async (req, res) => {
  try {
    const { name, code, address, phone, tenantId } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Thiếu tên hoặc mã chi nhánh' });
    }

    let tid = tenantId || req.headers['x-tenant-id'] || null;
    if (!tid) {
      const tenantService = require('../services/tenantService');
      const def = await tenantService.ensureDefaultTenant();
      tid = def._id;
    }

    const branch = await Branch.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address || '',
      phone: phone || '',
      tenantId: tid,
    });
    await invalidateBranchCache();

    return res.status(201).json({ success: true, message: `Đã thêm chi nhánh: ${name}`, data: branch });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyValue?.code ? 'Mã chi nhánh' : 'Tên chi nhánh';
      return res.status(409).json({ success: false, message: `${field} đã tồn tại` });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/branches/:id ─────────────────────────────────────────────────────
router.put('/:id', adminGuard('update'), async (req, res) => {
  try {
    const updates = {};
    const allowed = ['name', 'code', 'address', 'phone', 'isActive'];
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const updated = await Branch.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after', runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy chi nhánh' });
    await invalidateBranchCache();

    return res.json({ success: true, message: 'Đã cập nhật chi nhánh', data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/branches/:id ──────────────────────────────────────────────────
router.delete('/:id', adminGuard('delete'), async (req, res) => {
  try {
    // Soft-delete: chỉ đặt isActive = false để không mất data lịch sử
    const deleted = await Branch.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: 'after' });
    if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy chi nhánh' });
    await invalidateBranchCache();

    return res.json({ success: true, message: `Đã vô hiệu hóa chi nhánh: ${deleted.name}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
