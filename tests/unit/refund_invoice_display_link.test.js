'use strict';

/**
 * Display-only: refund Mã HĐ should match original payment invoice code.
 * Mirrors helpers in client/src/components/StudentDetailModal.jsx
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const isRefundInvoice = (inv) => {
  const ma = String(inv?.maHoaDon || '');
  const ghi = String(inv?.ghiChu || '');
  return ma.startsWith('R-') || /hoàn/i.test(ghi) || /refund/i.test(ghi);
};

const courseKeyOf = (name) => String(name || '').trim().toLowerCase();

const isValidInvoiceDisplayCode = (raw) => {
  const v = String(raw ?? '').trim();
  if (!v) return false;
  const upper = v.toUpperCase();
  if (v === '—' || upper === 'HĐ' || upper === 'HD' || upper === 'HOÀN') return false;
  if (/^cancel:/i.test(v)) return false;
  return true;
};

const resolveInvoiceDisplayCode = ({ maHoaDon, sourceRef } = {}) => {
  if (isValidInvoiceDisplayCode(maHoaDon)) return String(maHoaDon).trim();
  if (isValidInvoiceDisplayCode(sourceRef)) return String(sourceRef).trim();
  return null;
};

const enrollmentIdFromCancelRef = (sourceRef) => {
  const m = String(sourceRef || '').match(/^cancel:[^:]+:(.+)$/i);
  return m ? String(m[1]).trim() : '';
};

const resolveRefundLinkedInvoiceCode = ({
  line,
  allLines = [],
  invoiceList = [],
} = {}) => {
  const direct = resolveInvoiceDisplayCode({
    maHoaDon: line?.maHoaDon,
    sourceRef: line?.sourceRef,
  });
  if (direct) return direct;

  const lines = Array.isArray(allLines) ? allLines : [];
  const invoices = Array.isArray(invoiceList) ? invoiceList : [];

  if (line?.reversesEntryId) {
    const orig = lines.find((l) => String(l?._id) === String(line.reversesEntryId));
    const fromReverse = resolveInvoiceDisplayCode({
      maHoaDon: orig?.maHoaDon,
      sourceRef: orig?.sourceRef,
    });
    if (fromReverse) return fromReverse;
  }

  const enrId = String(line?.enrollmentId || '').trim()
    || enrollmentIdFromCancelRef(line?.sourceRef);

  const paymentCodeFromLine = (p) => resolveInvoiceDisplayCode({
    maHoaDon: p?.maHoaDon,
    sourceRef: p?.sourceRef,
  });

  if (enrId) {
    const payments = lines
      .filter((l) => {
        if (!l || l.type === 'refund') return false;
        return String(l.enrollmentId || '').trim() === enrId;
      })
      .slice()
      .sort((a, b) => new Date(b.postedAt || b.createdAt || 0) - new Date(a.postedAt || a.createdAt || 0));
    for (const p of payments) {
      const code = paymentCodeFromLine(p);
      if (code) return code;
    }
  }

  const courseKey = courseKeyOf(line?.courseName || line?.khoaHoc);
  if (courseKey) {
    const coursePayments = lines
      .filter((l) => {
        if (!l || l.type === 'refund') return false;
        return courseKeyOf(l.courseName) === courseKey;
      })
      .slice()
      .sort((a, b) => new Date(b.postedAt || b.createdAt || 0) - new Date(a.postedAt || a.createdAt || 0));
    for (const p of coursePayments) {
      const code = paymentCodeFromLine(p);
      if (code) return code;
    }

    const invPayments = invoices
      .filter((inv) => !isRefundInvoice(inv) && courseKeyOf(inv?.khoaHoc) === courseKey)
      .slice()
      .sort((a, b) => new Date(b.createdAt || b.ngayXuat || 0) - new Date(a.createdAt || a.ngayXuat || 0));
    for (const inv of invPayments) {
      if (isValidInvoiceDisplayCode(inv?.maHoaDon)) return String(inv.maHoaDon).trim();
    }
  }

  return null;
};

describe('resolveRefundLinkedInvoiceCode', () => {
  it('maps cancel: refund to payment sourceRef (HD) by enrollmentId', () => {
    const code = resolveRefundLinkedInvoiceCode({
      line: {
        type: 'refund',
        sourceRef: 'cancel:stu1:enr-thvp',
        enrollmentId: 'enr-thvp',
        courseName: 'thvp',
      },
      allLines: [
        {
          _id: 'pay1',
          type: 'payment',
          enrollmentId: 'enr-thvp',
          courseName: 'thvp',
          sourceRef: 'HD2608-0009',
          postedAt: '2026-08-10T00:00:00Z',
        },
        {
          _id: 'ref1',
          type: 'refund',
          enrollmentId: 'enr-thvp',
          courseName: 'thvp',
          sourceRef: 'cancel:stu1:enr-thvp',
          postedAt: '2026-08-11T00:00:00Z',
        },
      ],
    });
    assert.equal(code, 'HD2608-0009');
  });

  it('parses enrollmentId from cancel: sourceRef when enrollmentId missing', () => {
    const code = resolveRefundLinkedInvoiceCode({
      line: {
        type: 'refund',
        sourceRef: 'cancel:abc123:enr99',
        courseName: 'thvp',
      },
      allLines: [
        {
          _id: 'pay1',
          type: 'payment',
          enrollmentId: 'enr99',
          courseName: 'thvp',
          sourceRef: 'HD2608-0010',
        },
      ],
    });
    assert.equal(code, 'HD2608-0010');
  });

  it('falls back to invoice list by course name', () => {
    const code = resolveRefundLinkedInvoiceCode({
      line: {
        type: 'refund',
        sourceRef: 'cancel:x:y',
        courseName: 'thvp',
      },
      allLines: [],
      invoiceList: [
        { maHoaDon: 'HD2608-0011', khoaHoc: 'thvp', createdAt: '2026-08-01' },
      ],
    });
    assert.equal(code, 'HD2608-0011');
  });

  it('rejects cancel: as direct display code', () => {
    assert.equal(resolveInvoiceDisplayCode({ sourceRef: 'cancel:a:b' }), null);
    assert.equal(
      resolveRefundLinkedInvoiceCode({
        line: { sourceRef: 'cancel:a:b', courseName: 'x' },
        allLines: [],
        invoiceList: [],
      }),
      null,
    );
  });
});
