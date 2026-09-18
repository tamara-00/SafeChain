import mongoose from 'mongoose';

const { Schema, models, model } = mongoose;

const violationSchema = new Schema(
  {
    demo_code: { type: String, default: null },
    code_hash: { type: String, required: true, unique: true },
    ref_id: { type: String, required: true, unique: true },
    kind: {
      type: String,
      required: true,
      enum: ['speeding', 'red_light', 'expired_registration', 'no_parking'],
    },
    status: {
      type: String,
      enum: ['unpaid', 'paid', 'voided', 'appeal_pending'],
      default: null,
    },
    plate: { type: String, required: true },
    vehicle_make: { type: String, required: true },
    car_color: { type: String, required: true },
    date_time: { type: Date, required: true },
    street_mk: { type: String, required: true },
    street_en: { type: String, required: true },
    street_sr: { type: String, required: true },
    city_mk: { type: String, required: true },
    city_en: { type: String, required: true },
    city_sr: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed_recorded: { type: Number, default: null },
    speed_limit: { type: Number, default: null },
    camera_id: { type: String, required: true },
    issued_at: { type: Date, required: true },
    due_date: { type: String, required: true },
    early_payment_deadline: { type: String, required: true },
    early_payment_discount_percent: { type: Number, required: true, default: 50 },
    base_fine_eur: { type: Number, required: true },
    base_fine_mkd: { type: Number, required: true },
    amount_due_mkd: { type: Number, required: true },
    penalty_points: { type: Number, default: null },
    driving_ban_mk: { type: String, default: null },
    driving_ban_en: { type: String, default: null },
    driving_ban_sr: { type: String, default: null },
    owner_fine_eur: { type: Number, default: null },
    parking_severity: { type: String, default: null },
    legal_note_mk: { type: String, required: true },
    legal_note_en: { type: String, required: true },
    legal_note_sr: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'violations' },
);

const paymentSchema = new Schema(
  {
    receipt_id: { type: String, default: null, unique: true, sparse: true },
    code_hash: { type: String, required: true },
    method: { type: String, required: true, enum: ['crypto', 'non_crypto'] },
    status: { type: String, required: true, default: 'confirmed' },
    amount_mkd: { type: Number, required: true },
    amount_sol: { type: Number, default: null },
    payer: { type: String, default: null },
    signature: { type: String, default: null, unique: true, sparse: true },
    memo: { type: String, default: null },
    memo_summary: { type: Schema.Types.Mixed, default: null },
    network: { type: String, default: null },
    provider: { type: String, default: null },
    paid_at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, collection: 'payments' },
);

paymentSchema.index({ code_hash: 1, paid_at: -1 });

export const Violation = models.Violation || model('Violation', violationSchema);
export const Payment = models.Payment || model('Payment', paymentSchema);
