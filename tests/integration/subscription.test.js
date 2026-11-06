'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const service = require('../../services/subscriptionService');
const Student = require('../../models/Student');
const ActivationCode = require('../../models/ActivationCode');
const SubscriptionLog = require('../../models/SubscriptionLog');
const PaymentSession = require('../../models/PaymentSession');
const LedgerEntry = require('../../models/LedgerEntry');

const TEST_DB = process.env.TEST_DATABASE_URI || '';
const dbSkip = /test/i.test(TEST_DB) ? false : 'TEST_DATABASE_URI (test DB) chưa cấu hình';
const DAY = 24 * 60 * 60 * 1000;

test('statusOf: HV cũ thiếu trường = vĩnh viễn; tính còn hạn / sắp hết / hết hạn', () => {
  const now = new Date('2026-05-10T00:00:00Z');
  assert.equal(service.statusOf({}, now).state, 'lifetime');
  assert.equal(service.statusOf({ subscription: { plan: 'lifetime' } }, now).state, 'lifetime');
  const active = service.statusOf({ subscription: { plan: '3m', expiresAt: new Date(now.getTime() + 30 * DAY), activatedAt: now } }, now);
  assert.equal(active.state, 'active');
  assert.equal(active.daysLeft, 30);
  assert.equal(service.statusOf({ subscription: { plan: '1m', expiresAt: new Date(now.getTime() + 3 * DAY) } }, now).state, 'expiring');
  const expired = service.statusOf({ subscription: { plan: '1m', expiresAt: new Date(now.getTime() - 1000) } }, now);
  assert.equal(expired.state, 'expired');
  assert.equal(expired.activated, false);
});

test('nextExpiry: cộng từ max(hôm nay, hạn cũ); cuối tháng không tràn', () => {
  const now = new Date('2026-05-10T00:00:00Z');
  assert.equal(service.nextExpiry(new Date('2026-06-01T00:00:00Z'), '1m', now).toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(service.nextExpiry(new Date('2026-01-01T00:00:00Z'), '3m', now).toISOString(), '2026-08-10T00:00:00.000Z');
  assert.equal(service.nextExpiry(null, 'lifetime', now), null);
  assert.equal(service.addMonths(new Date(2026, 0, 31), 1).getMonth(), 1, '31/1 + 1 tháng vẫn ở tháng 2');
});

test('pickReminder: chỉ 2 mốc — còn 7 ngày và ngày cuối, mỗi mốc 1 lần', () => {
  const now = new Date('2026-05-10T01:00:00Z');
  const expiresAt = new Date(now.getTime() + 6.5 * DAY);
  const student = { subscription: { plan: '1m', expiresAt, remindedFor: [] } };
  const first = service.pickReminder(student, now);
  assert.ok(first.key.endsWith(':7'), 'còn 7 ngày → mốc 7');
  student.subscription.remindedFor = [first.key];
  assert.equal(service.pickReminder(student, now), null, 'đã nhắc mốc này thì không nhắc lại');
  const threeDaysLeft = new Date(expiresAt.getTime() - 3 * DAY);
  assert.equal(service.pickReminder(student, threeDaysLeft), null, 'còn 3 ngày: không nhắc thêm');
  const lastDay = new Date(expiresAt.getTime() - 12 * 60 * 60 * 1000);
  const last = service.pickReminder(student, lastDay);
  assert.ok(last.key.endsWith(':1'), 'ngày cuối → mốc 1');
  assert.equal(service.pickReminder({ subscription: { plan: '1m', expiresAt: new Date(now.getTime() + 20 * DAY) } }, now), null);
  assert.equal(service.pickReminder({ subscription: { plan: 'lifetime' } }, now), null);
  assert.equal(service.pickReminder({ subscription: { plan: '1m', expiresAt: new Date(now.getTime() - DAY) } }, now), null, 'đã hết hạn: không nhắc');
});

test('gói tài khoản trên DB: mã dùng 1 lần, gia hạn, vĩnh viễn, thanh toán idempotent, nhắc không trùng', { skip: dbSkip }, async () => {
  await mongoose.connect(TEST_DB);
  const studentId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();
  const legacyId = new mongoose.Types.ObjectId();
  const batchIds = [];
  const sessionIds = [];
  const oldPrices = await service.getPrices();
  try {
    const soon = new Date(Date.now() + 2 * DAY);
    await Student.collection.insertMany([
      { _id: studentId, name: 'HV Gói', studentCode: 'HVSUB01', subscription: { plan: '1m', expiresAt: soon, activatedAt: new Date(), remindedFor: [] } },
      { _id: otherId, name: 'HV Khác', studentCode: 'HVSUB02', subscription: { plan: '1m', expiresAt: new Date(Date.now() - DAY), activatedAt: null, remindedFor: [] } },
      { _id: legacyId, name: 'HV Cũ', studentCode: 'HVSUB03' },
    ]);

    assert.equal((await service.myOverview(legacyId)).subscription.state, 'lifetime', 'HV cũ mặc định vĩnh viễn');

    const found = await service.searchStudents('hv go');
    assert.ok(found.some((row) => row.id === String(studentId)), 'admin tìm HV trên server (không dấu, gõ dở)');
    assert.ok((await service.searchStudents('HVSUB03')).some((row) => row.id === String(legacyId)), 'tìm theo mã HV');
    assert.equal((await service.searchStudents('HVSUB01', { branchId: new mongoose.Types.ObjectId() })).length, 0, 'giới hạn theo chi nhánh');
    assert.deepEqual(await service.searchStudents('   '), []);

    const batch = await service.generateCodes({ plan: '3m', quantity: 3, note: 'test', actor: { id: 'admin', name: 'Admin' } });
    batchIds.push(batch.batchId);
    assert.equal(batch.codes.length, 3);
    assert.ok(batch.codes.every((c) => /^TTH-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c.code)));

    // 2 HV nhập cùng 1 mã đồng thời: chỉ 1 người thành công.
    const [code1, code2, code3] = batch.codes;
    const results = await Promise.allSettled([
      service.redeemCode(studentId, code1.code.toLowerCase()),
      service.redeemCode(otherId, code1.code.replace(/-/g, '')),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'mã chỉ dùng được 1 lần');
    assert.equal(results.filter((r) => r.status === 'rejected')[0].reason.status, 409);
    const winnerId = results[0].status === 'fulfilled' ? studentId : otherId;
    const winner = await Student.findById(winnerId).lean();
    const expectedBase = winnerId === studentId ? soon : new Date();
    const delta = Math.abs(new Date(winner.subscription.expiresAt).getTime() - service.addMonths(expectedBase, 3).getTime());
    assert.ok(delta < 60 * 1000, 'gia hạn cộng từ max(hôm nay, hạn cũ)');

    await assert.rejects(service.redeemCode(studentId, 'TTH-0000-0000'), { status: 404 });
    await service.revokeCode(code3.id);
    await assert.rejects(service.redeemCode(studentId, code3.code), { status: 409 });
    await assert.rejects(service.revokeCode(code1.id), { status: 409 }, 'mã đã dùng không thu hồi được');

    // Hết hạn → nhập mã → mở khóa (hạn tính từ hôm nay).
    await Student.updateOne({ _id: otherId }, { $set: { 'subscription.expiresAt': new Date(Date.now() - DAY) } });
    const unlocked = await service.redeemCode(otherId, code2.code);
    assert.equal(unlocked.state, 'active');
    assert.equal(unlocked.activated, true);

    // Thanh toán: checkout → webhook claim → fulfill 2 lần chỉ gia hạn 1 lần.
    await service.setPrices({ '1m': 150000 });
    await assert.rejects(service.checkout(legacyId, '1m'), { status: 409 }, 'HV vĩnh viễn không cần gia hạn');
    const checkout = await service.checkout(studentId, '1m');
    sessionIds.push(checkout.sessionId);
    assert.match(checkout.ref, /GIA HAN \d{5}$/);
    assert.equal(checkout.amount, 150000);
    const again = await service.checkout(studentId, '1m');
    assert.equal(again.sessionId, checkout.sessionId, 'phiên đang chờ được dùng lại');

    const before = (await Student.findById(studentId).lean()).subscription.expiresAt;
    const claimed = await PaymentSession.findOneAndUpdate(
      { sessionId: checkout.sessionId, status: 'pending' },
      { $set: { status: 'paid', paidAmount: 150000 } },
      { new: true },
    ).lean();
    await service.fulfillSubscriptionPayment({ session: claimed, amount: 150000 });
    const dup = await service.fulfillSubscriptionPayment({ session: claimed, amount: 150000 });
    assert.equal(dup.duplicated, true);
    const after = (await Student.findById(studentId).lean()).subscription.expiresAt;
    assert.equal(new Date(after).getTime(), service.addMonths(new Date(before), 1).getTime(), 'chỉ cộng 1 tháng');
    assert.equal(await SubscriptionLog.countDocuments({ paymentSessionId: checkout.sessionId }), 1);
    assert.equal(await LedgerEntry.countDocuments({ sourceRef: checkout.sessionId }), 1, 'ghi sổ thu 1 lần');
    assert.equal((await service.sessionStatus(studentId, checkout.sessionId)).paid, true);

    // Admin: lên vĩnh viễn rồi yêu cầu nhập mã.
    const lifetime = await service.adminSetSubscription(otherId, { mode: 'extend', plan: 'lifetime' }, { id: 'admin', name: 'Admin' });
    assert.equal(lifetime.state, 'lifetime');
    await assert.rejects(service.applyRenewal(otherId, '1m', { source: 'admin' }), { code: 'SUBSCRIPTION_LIFETIME' });
    const locked = await service.adminSetSubscription(otherId, { mode: 'require_activation' }, { id: 'admin', name: 'Admin' });
    assert.equal(locked.state, 'expired');
    assert.equal(locked.activated, false);

    // Nhắc gia hạn: gửi 1 lần cho mỗi mốc.
    await Student.updateOne({ _id: studentId }, { $set: { 'subscription.expiresAt': new Date(Date.now() + 2 * DAY), 'subscription.remindedFor': [] } });
    const notified = [];
    const notify = async ({ studentId: id }) => { notified.push(id); };
    await service.sendExpiryReminders({ notify });
    await service.sendExpiryReminders({ notify });
    assert.equal(notified.filter((id) => id === String(studentId)).length, 1, 'không nhắc trùng');
    assert.equal(notified.filter((id) => id === String(otherId)).length, 0, 'HV đã hết hạn không nhận nhắc');
    await Student.updateOne({ _id: studentId }, { $set: { 'subscription.expiresAt': new Date(Date.now() + 12 * 60 * 60 * 1000) } });
    await service.sendExpiryReminders({ notify });
    await service.sendExpiryReminders({ notify });
    assert.equal(notified.filter((id) => id === String(studentId)).length, 2, 'ngày cuối nhắc thêm đúng 1 lần');
  } finally {
    await service.setPrices(oldPrices);
    const ids = [studentId, otherId, legacyId];
    await ActivationCode.deleteMany({ batchId: { $in: batchIds } });
    await SubscriptionLog.deleteMany({ studentId: { $in: ids } });
    await PaymentSession.deleteMany({ studentId: { $in: ids } });
    await LedgerEntry.deleteMany({ studentId: { $in: ids } });
    await Student.collection.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  }
});
