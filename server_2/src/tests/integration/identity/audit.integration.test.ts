import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoAuditRepository } from '../../../infrastructure/repositories/AuditRepository';
import { AuditLogModel, AuditLogDocument } from '../../../infrastructure/database/models/AuditLogModel';

describe('Audit log persistence (Batch 7)', () => {
  let txContext: TransactionContext;
  let repo: MongoAuditRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoAuditRepository(txContext);
  });

  afterEach(async () => {
    await AuditLogModel.deleteMany({});
  });

  describe('create', () => {
    it('persists an audit log row with all fields', async () => {
      const performedAt = new Date();

      await repo.create({
        actorId: 'admin-1',
        action: 'BAN_USER',
        targetModel: 'User',
        targetId: 'user-1',
        meta: { reason: 'fraud' },
        performedAt,
        details: 'Banned for fraud',
        ipAddress: '127.0.0.1',
      });

      const rows = await AuditLogModel.find({}).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'BAN_USER',
        targetModel: 'User',
        targetId: 'user-1',
        meta: { reason: 'fraud' },
        details: 'Banned for fraud',
        ipAddress: '127.0.0.1',
      });
      expect(rows[0].performedAt).toEqual(performedAt);
    });

    it('persists a row with only the required fields, defaulting performedAt', async () => {
      const before = Date.now();

      await repo.create({ actorId: 'admin-2', action: 'LOGIN' });

      const rows = await AuditLogModel.find({ actorId: 'admin-2' }).lean();
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('LOGIN');
      expect(rows[0].performedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('findByActorId', () => {
    it('returns rows for an actor, most recent first, up to the limit', async () => {
      const base = Date.now();
      await AuditLogModel.create([
        { actorId: 'admin-1', action: 'A', performedAt: new Date(base + 100) },
        { actorId: 'admin-1', action: 'B', performedAt: new Date(base + 300) },
        { actorId: 'admin-1', action: 'C', performedAt: new Date(base + 200) },
        { actorId: 'admin-2', action: 'D', performedAt: new Date(base + 400) },
      ]);

      const rows = await repo.findByActorId('admin-1');
      expect(rows.map((r: AuditLogDocument) => r.action)).toEqual(['B', 'C', 'A']);

      const limited = await repo.findByActorId('admin-1', 2);
      expect(limited.map((r: AuditLogDocument) => r.action)).toEqual(['B', 'C']);
    });

    it('returns an empty array when the actor has no audit rows', async () => {
      const rows = await repo.findByActorId('nobody');
      expect(rows).toEqual([]);
    });
  });
});
