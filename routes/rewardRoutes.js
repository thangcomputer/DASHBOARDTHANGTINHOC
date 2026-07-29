/**
 * Reward API — rules + period job + payout approve (Phase 12).
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const RewardRule = require('../models/RewardRule');
const RewardPayout = require('../models/RewardPayout');
const {
  runRewardPeriodJob,
  approveRewardPayout,
  rejectRewardPayout,
  computeFiveStarStats,
  computeRewardAmount,
  periodKeyFor,
} = require('../services/rewardService');
const logger = require('../config/logger');

function requireAdminStaff(req, res) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    res.status(403).json({ success: false, message: 'Chỉ Admin/Staff được quản lý thưởng' });
    return false;
  }
  return true;
}

// GET /api/rewards/rules
router.get(
  '/rules',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const filter = {};
      if (req.branchFilter?.branchId) {
        filter.$or = [{ branchId: req.branchFilter.branchId }, { branchId: null }];
      }
      const rules = await RewardRule.find(filter).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: rules });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// POST /api/rewards/rules
router.post(
  '/rules',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const {
        name,
        thresholdPct = 80,
        minRatings = 10,
        amount = 500000,
        period = 'month',
        branchId = null,
        note = '',
        active = true,
      } = req.body || {};

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Thiếu tên rule' });
      }
      const rule = await RewardRule.create({
        name: String(name).trim(),
        metric: 'pct_5star',
        thresholdPct: Number(thresholdPct),
        minRatings: Number(minRatings),
        amount: Number(amount),
        period,
        branchId: branchId || req.branchFilter?.branchId || null,
        active: active !== false,
        createdBy: String(req.user.id || ''),
        note: String(note || '').slice(0, 500),
      });
      return res.status(201).json({ success: true, data: rule });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
);

// PATCH /api/rewards/rules/:id
router.patch(
  '/rules/:id',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const allowed = ['name', 'thresholdPct', 'minRatings', 'amount', 'period', 'active', 'note', 'branchId'];
      const updates = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      const rule = await RewardRule.findByIdAndUpdate(req.params.id, updates, {
        returnDocument: 'after',
        runValidators: true,
      });
      if (!rule) return res.status(404).json({ success: false, message: 'Không tìm thấy rule' });
      return res.json({ success: true, data: rule });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
);

// GET /api/rewards/payouts
router.get(
  '/payouts',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.periodKey) filter.periodKey = req.query.periodKey;
      if (req.branchFilter?.branchId) filter.branchId = req.branchFilter.branchId;
      const rows = await RewardPayout.find(filter).sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ success: true, data: rows });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// POST /api/rewards/run — chạy job kỳ (tạo draft)
router.post(
  '/run',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const {
        periodType = 'month',
        periodKey = null,
        ruleId = null,
      } = req.body || {};
      const result = await runRewardPeriodJob({
        periodType,
        periodKey,
        branchId: req.branchFilter?.branchId || req.body.branchId || null,
        ruleId,
        actor: { id: req.user.id, role: req.user.role },
        io: req.app.get('io'),
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/rewards/payouts/:id/approve
router.put(
  '/payouts/:id/approve',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const markPaid = req.body?.markPaid !== false;
      const result = await approveRewardPayout({
        payoutId: req.params.id,
        actor: { id: req.user.id, role: req.user.role, name: req.user.name },
        markPaid,
        io: req.app.get('io'),
        reqMeta: {
          ip: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          branchId: req.userBranchId || null,
        },
        note: req.body?.note || '',
      });
      return res.json({
        success: true,
        message: result.payout.status === 'paid' ? 'Đã duyệt và chi thưởng' : 'Đã duyệt phiếu thưởng',
        data: result.payout,
        ledgerEntryId: result.ledgerEntry?._id || null,
      });
    } catch (err) {
      const status = err.status || 500;
      logger.error('[REWARD] approve:', err);
      return res.status(status).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/rewards/payouts/:id/reject
router.put(
  '/payouts/:id/reject',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const payout = await rejectRewardPayout({
        payoutId: req.params.id,
        actor: { id: req.user.id, role: req.user.role },
        reason: req.body?.reason || '',
        reqMeta: { branchId: req.userBranchId || null },
      });
      return res.json({ success: true, data: payout });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },
);

// POST /api/rewards/preview — tính thử (không ghi DB) — dùng fixture / debug
router.post(
  '/preview',
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_HR),
  async (req, res) => {
    try {
      if (!requireAdminStaff(req, res)) return undefined;
      const { ratings = [], rule = {} } = req.body || {};
      const stats = computeFiveStarStats(ratings);
      const amount = computeRewardAmount(stats, {
        thresholdPct: rule.thresholdPct ?? 80,
        minRatings: rule.minRatings ?? 10,
        amount: rule.amount ?? 500000,
      });
      return res.json({
        success: true,
        data: {
          stats,
          amount,
          periodKey: periodKeyFor(rule.period || 'month'),
          qualifies: amount > 0,
        },
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
