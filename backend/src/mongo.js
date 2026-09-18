import { amountDueNowMKD, codeHash } from './pricing.js';
import { connectMongo, hasMongo } from './db/connection.js';
import { Payment, Violation } from './db/models.js';

export class DatabaseError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DatabaseError';
    this.status = status;
  }
}

export { hasMongo };

async function ensureConnection(config) {
  if (!hasMongo(config)) throw new DatabaseError(0, 'MongoDB is not configured');
  try {
    await connectMongo(config);
  } catch (error) {
    throw new DatabaseError(500, error.message);
  }
}

export function violationToDb(v, pepper, options = {}) {
  const row = {
    code_hash: codeHash(v.code, pepper),
    ref_id: v.refId,
    kind: v.kind,
    plate: v.plate,
    vehicle_make: v.vehicleMake,
    car_color: v.carColor,
    date_time: v.dateTime,
    street_mk: v.street.mk,
    street_en: v.street.en,
    street_sr: v.street.sr,
    city_mk: v.city.mk,
    city_en: v.city.en,
    city_sr: v.city.sr,
    lat: v.coordinates.lat,
    lng: v.coordinates.lng,
    speed_recorded: v.speedRecorded ?? null,
    speed_limit: v.speedLimit ?? null,
    camera_id: v.cameraId,
    issued_at: v.issuedAt,
    due_date: v.dueDate,
    early_payment_deadline: v.earlyPaymentDeadline,
    early_payment_discount_percent: v.earlyPaymentDiscountPercent,
    base_fine_eur: v.baseFineEUR,
    base_fine_mkd: v.baseFineMKD,
    amount_due_mkd: amountDueNowMKD(v),
    penalty_points: v.penaltyPoints ?? null,
    driving_ban_mk: v.drivingBan?.mk ?? null,
    driving_ban_en: v.drivingBan?.en ?? null,
    driving_ban_sr: v.drivingBan?.sr ?? null,
    owner_fine_eur: v.ownerFineEUR ?? null,
    parking_severity: v.parkingSeverity ?? null,
    legal_note_mk: v.legalNote.mk,
    legal_note_en: v.legalNote.en,
    legal_note_sr: v.legalNote.sr,
  };
  if (options.includeDemoFields !== false) {
    row.demo_code = v.code;
    row.status = v.status ?? null;
  }
  return row;
}

export function dbToViolation(row, code) {
  return {
    code: code ?? row.demo_code,
    refId: row.ref_id,
    kind: row.kind,
    status: row.status ?? undefined,
    plate: row.plate,
    vehicleMake: row.vehicle_make,
    carColor: row.car_color,
    dateTime: row.date_time instanceof Date ? row.date_time.toISOString() : row.date_time,
    street: { mk: row.street_mk, en: row.street_en, sr: row.street_sr },
    city: { mk: row.city_mk, en: row.city_en, sr: row.city_sr },
    coordinates: { lat: Number(row.lat), lng: Number(row.lng) },
    speedRecorded: row.speed_recorded ?? undefined,
    speedLimit: row.speed_limit ?? undefined,
    cameraId: row.camera_id,
    issuedAt: row.issued_at instanceof Date ? row.issued_at.toISOString() : row.issued_at,
    dueDate: row.due_date,
    earlyPaymentDeadline: row.early_payment_deadline,
    earlyPaymentDiscountPercent: row.early_payment_discount_percent,
    baseFineEUR: Number(row.base_fine_eur),
    baseFineMKD: row.base_fine_mkd,
    amountDueMKD: row.amount_due_mkd,
    penaltyPoints: row.penalty_points ?? undefined,
    drivingBan: row.driving_ban_mk
      ? { mk: row.driving_ban_mk, en: row.driving_ban_en, sr: row.driving_ban_sr }
      : undefined,
    ownerFineEUR: row.owner_fine_eur ? Number(row.owner_fine_eur) : undefined,
    parkingSeverity: row.parking_severity ?? undefined,
    legalNote: { mk: row.legal_note_mk, en: row.legal_note_en, sr: row.legal_note_sr },
  };
}

export function paymentToDb(payment, code, pepper) {
  return {
    receipt_id: payment.receiptId ?? null,
    code_hash: codeHash(code, pepper),
    method: payment.method,
    status: 'confirmed',
    amount_mkd: payment.amountMKD,
    amount_sol: payment.amountSol ?? null,
    payer: payment.payer ?? null,
    signature: payment.signature ?? null,
    memo: payment.memo ?? null,
    memo_summary: payment.memoSummary ?? null,
    network: payment.network ?? null,
    provider: payment.provider ?? null,
    paid_at: payment.paidAtIso,
  };
}

export function dbToPayment(row) {
  return {
    method: row.method,
    receiptId: row.receipt_id ?? undefined,
    signature: row.signature ?? undefined,
    paidAtIso: row.paid_at instanceof Date ? row.paid_at.toISOString() : row.paid_at,
    amountMKD: row.amount_mkd,
    amountSol: row.amount_sol ? Number(row.amount_sol) : undefined,
    payer: row.payer ?? undefined,
    memo: row.memo ?? undefined,
    memoSummary: row.memo_summary ?? undefined,
    network: row.network ?? undefined,
    provider: row.provider ?? undefined,
  };
}

export async function selectViolationByCode(config, code) {
  await ensureConnection(config);
  const hash = codeHash(code, config.securityCodePepper);
  const row = await Violation.findOne({ code_hash: hash }).lean();
  return row ? dbToViolation(row, code) : null;
}

export async function selectViolations(config) {
  await ensureConnection(config);
  const rows = await Violation.find({ demo_code: { $ne: null } })
    .sort({ issued_at: -1 })
    .lean();
  return rows.map((row) => dbToViolation(row));
}

export async function checkDatabase(config) {
  await ensureConnection(config);
  await Violation.findOne().select('_id').lean();
  await Payment.findOne().select('_id').lean();
  return true;
}

export async function selectLatestPayment(config, code) {
  await ensureConnection(config);
  const hash = codeHash(code, config.securityCodePepper);
  const row = await Payment.findOne({ code_hash: hash }).sort({ paid_at: -1 }).lean();
  return row ? dbToPayment(row) : null;
}

export async function insertPayment(config, code, payment) {
  await ensureConnection(config);
  const doc = await Payment.create(paymentToDb(payment, code, config.securityCodePepper));
  return dbToPayment(doc.toObject());
}

export async function upsertViolations(config, violations) {
  await ensureConnection(config);
  const results = [];
  for (const violation of violations) {
    const row = violationToDb(violation, config.securityCodePepper, { includeDemoFields: true });
    const updated = await Violation.findOneAndUpdate(
      { ref_id: row.ref_id },
      { $set: row },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    results.push(updated);
  }
  return results;
}

export async function deleteViolationsExceptRefs(config, refIds) {
  await ensureConnection(config);
  const keep = new Set(refIds);
  const rows = await Violation.find().select('ref_id').lean();
  const staleRefs = rows.map((row) => row.ref_id).filter((refId) => !keep.has(refId));

  if (staleRefs.length === 0) return [];

  const deleted = await Violation.find({ ref_id: { $in: staleRefs } }).lean();
  await Violation.deleteMany({ ref_id: { $in: staleRefs } });
  return deleted;
}
