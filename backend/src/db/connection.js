import mongoose from 'mongoose';

let connectPromise = null;

export function getMongoUri(config) {
  return config.mongodbUri;
}

export function hasMongo(config) {
  return Boolean(getMongoUri(config));
}

export async function connectMongo(config) {
  if (!hasMongo(config)) {
    throw new Error('MongoDB is not configured (set MONGODB_URI)');
  }
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectPromise) {
    connectPromise = mongoose
      .connect(getMongoUri(config), { dbName: config.mongodbDbName || undefined })
      .catch((error) => {
        connectPromise = null;
        throw error;
      });
  }
  await connectPromise;
  return mongoose.connection;
}
