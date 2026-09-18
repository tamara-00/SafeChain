import mongoose from 'mongoose';
import { getConfig } from './env.js';
import { DEMO_VIOLATIONS } from './demoData.js';
import { deleteViolationsExceptRefs, hasMongo, upsertViolations } from './mongo.js';

const config = getConfig();

if (!hasMongo(config)) {
  console.error('MongoDB is not configured. Set MONGODB_URI.');
  process.exit(1);
}

const rows = await upsertViolations(config, DEMO_VIOLATIONS);
const deleted = await deleteViolationsExceptRefs(
  config,
  DEMO_VIOLATIONS.map((violation) => violation.refId),
);
console.log(
  `Seeded ${rows.length} violation records into MongoDB. Removed ${deleted.length} stale records.`,
);

await mongoose.disconnect();
