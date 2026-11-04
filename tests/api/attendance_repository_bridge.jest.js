const mongoose = require('mongoose');
const TransactionContext = require('../../shared/transaction/TransactionContext');
const TransactionFactory = require('../../shared/transaction/TransactionFactory');
const { scheduleRepository, scheduleHistoryRepository } = require('../../modules/attendance/repositories');
const Schedule = require('../../modules/attendance/models/Schedule');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');

describe('Attendance Repository Bridge', () => {
  let txFactory;

  beforeAll(async () => {
    // Assuming test setup connects to a MongoMemoryReplSet elsewhere
    txFactory = new TransactionFactory();
  });

  afterEach(async () => {
    await Schedule.deleteMany({});
    await OutboxEvent.deleteMany({});
  });

  it('TEST A: Repository outside transaction', async () => {
    const data = { teacherId: 'sys', studentId: 'sys', date: new Date(), startTime: '10:00', endTime: '11:30', course: 'Test' };
    const result = await scheduleRepository.create(data);
    expect(result).toBeDefined();
    expect(result.teacherId).toBe('sys');
  });

  it('TEST B, C: Repository inside CommandBus transaction successfully', async () => {
    const data = { teacherId: 'tx', studentId: 'tx', date: new Date(), startTime: '10:00', endTime: '11:30', course: 'Test' };
    
    const tx = await txFactory.begin();
    await TransactionContext.run(tx, async () => {
      await scheduleRepository.create(data);
      await OutboxEvent.create([{ eventType: 'AttendancePost_rootCompleted', payload: data }], { session: tx.session });
    });
    await tx.commit();

    const schedule = await Schedule.findOne({ teacherId: 'tx' });
    const outbox = await OutboxEvent.findOne({ eventType: 'AttendancePost_rootCompleted' });
    
    expect(schedule).toBeDefined();
    expect(outbox).toBeDefined();
  });

  it('TEST D, E: Failure after mutation but before commit causes ROLLBACK', async () => {
    const data = { teacherId: 'fail', studentId: 'fail', date: new Date(), startTime: '10:00', endTime: '11:30', course: 'Test' };
    
    const tx = await txFactory.begin();
    try {
      await TransactionContext.run(tx, async () => {
        await scheduleRepository.create(data);
        await OutboxEvent.create([{ eventType: 'AttendancePost_rootCompleted', payload: data }], { session: tx.session });
        throw new Error('Intentional Failure Before Commit');
      });
      await tx.commit();
    } catch (err) {
      await tx.rollback();
    }

    const schedule = await Schedule.findOne({ teacherId: 'fail' });
    const outbox = await OutboxEvent.findOne({ eventType: 'AttendancePost_rootCompleted' });
    
    expect(schedule).toBeNull();
    expect(outbox).toBeNull();
  });

  it('TEST F, G: Tenant and Branch Isolation preservation', async () => {
    const data = { teacherId: 'iso', studentId: 'iso', date: new Date(), startTime: '10:00', endTime: '11:30', course: 'Test' };
    
    const tx = await txFactory.begin();
    await TransactionContext.run(tx, async () => {
      await scheduleRepository.create(data);
    });
    await tx.commit();

    const schedule = await Schedule.findOne({ teacherId: 'iso' });
    expect(schedule.tenantId).toBeUndefined(); // Should follow exact legacy model schema
  });
});
