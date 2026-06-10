// Mongoose connect — reads MONGO_URI from env, emits ready/error events
import mongoose, { Connection } from 'mongoose';

let listenersAttached = false;

function attachConnectionListeners(connection: Connection): void {
  if (listenersAttached) {
    return;
  }

  connection.on('connected', () => {
    console.log('[mongo] connection established');
  });

  connection.on('error', (error: Error) => {
    console.error('[mongo] connection error', error);
  });

  connection.on('disconnected', () => {
    console.log('[mongo] connection disconnected');
  });

  listenersAttached = true;
}

export async function connectDB(uri: string = process.env.MONGO_URI ?? ''): Promise<Connection> {
  if (!uri) {
    throw new Error('MONGO_URI is not defined');
  }

  attachConnectionListeners(mongoose.connection);

  await mongoose.connect(uri);

  return mongoose.connection;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

export function getConnection(): Connection {
  return mongoose.connection;
}
