import mongoose from 'mongoose';
import { connectDB, disconnectDB, getConnection } from '../../../infrastructure/database/connection';
import { getTestMongoUri } from '../../setup';

describe('Mongo connection bootstrap', () => {
  it('connects to the in-memory replica set via the global test setup', () => {
    expect(getConnection().readyState).toBe(mongoose.ConnectionStates.connected);
  });

  it('disconnects and reconnects cleanly', async () => {
    await disconnectDB();
    expect(getConnection().readyState).toBe(mongoose.ConnectionStates.disconnected);

    await connectDB(getTestMongoUri());
    expect(getConnection().readyState).toBe(mongoose.ConnectionStates.connected);
  });
});
