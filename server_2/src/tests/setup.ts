// Global integration test setup — boots a MongoMemoryReplSet (transactions
// require a replica set) and connects Mongoose to it for the duration of
// each integration test file.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../infrastructure/database/connection';

let replSet: MongoMemoryReplSet;
let uri: string;

export function getTestMongoUri(): string {
  return uri;
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  uri = replSet.getUri();
  await connectDB(uri);
}, 120000);

afterAll(async () => {
  await disconnectDB();
  await replSet.stop();
}, 120000);
