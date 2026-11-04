const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../server'); // Adjust to your actual server export
const Teacher = require('../../modules/teacher/models/Teacher');
const OutboxEvent = require('../../shared/outbox/OutboxEvent');
const { generateAdminToken, generateStaffToken } = require('../fixtures/tokenGenerator');

describe('Teacher CQRS Migration - POST /api/teachers', () => {
  let adminToken;
  let testBranchId;

  beforeAll(async () => {
    // Assuming DB is connected via setup files or we need to connect here
    adminToken = await generateAdminToken();
    testBranchId = new mongoose.Types.ObjectId().toString();
  });

  afterEach(async () => {
    await Teacher.deleteMany({ phone: '0999999999' });
    await OutboxEvent.deleteMany({ eventType: 'TeacherCreatedEvent' });
  });

  it('1. Legacy POST works (ENABLE_CQRS_TEACHER=false)', async () => {
    process.env.ENABLE_CQRS_TEACHER = 'false';
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Legacy Teacher',
        phone: '0999999999',
        branchId: testBranchId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Legacy Teacher');

    // Should NOT have an outbox event because it's legacy
    const outbox = await OutboxEvent.findOne({ aggregateId: res.body.data._id });
    expect(outbox).toBeNull();
  });

  it('2. CQRS POST works and produces identical contract (ENABLE_CQRS_TEACHER=true)', async () => {
    process.env.ENABLE_CQRS_TEACHER = 'true';
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'CQRS Teacher',
        phone: '0999999999',
        branchId: testBranchId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('CQRS Teacher');
    expect(res.body.data.welcomeQueued).toBeDefined();

    // MUST have an outbox event in the same transaction
    const outbox = await OutboxEvent.findOne({ aggregateId: res.body.data._id });
    expect(outbox).not.toBeNull();
    expect(outbox.eventType).toBe('TeacherCreatedEvent');
    expect(outbox.payload.plainPassword).toBeDefined(); // Used for Welcome Email later
  });

  it('3. Intentional failure rolls back Teacher and Outbox', async () => {
    process.env.ENABLE_CQRS_TEACHER = 'true';
    
    // Simulate a failure by sending an invalid payload that passes initial validation but fails in DB or handler
    // e.g., missing name
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '',
        phone: '0999999999'
      });

    expect(res.status).toBe(400);

    const teacher = await Teacher.findOne({ phone: '0999999999' });
    expect(teacher).toBeNull();

    const outbox = await OutboxEvent.findOne({ 'payload.phone': '0999999999' });
    expect(outbox).toBeNull();
  });
});
