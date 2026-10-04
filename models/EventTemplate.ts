import mongoose, { Schema, model, models } from "mongoose";

import {
  EVENT_TEMPLATE_KINDS,
  PAYMENT_METHODS,
  type EventTemplateKind,
  type PaymentMethod,
} from "@/lib/constants";

export { EVENT_TEMPLATE_KINDS };
export type { EventTemplateKind };

/**
 * A night or activity the admin runs again and again — karaoke Wednesdays, the
 * Saturday drawing club — saved once so a new date is two taps, not a form
 * (`PLAN/DEKKA_PWA_APP.md` §4).
 *
 * It holds the reusable half of an `Event` and nothing that belongs to one
 * particular occurrence: no date, no status, no `doorsOpenAt`. Those are set
 * when an event is made from it, by `buildEventFromTemplate` (lib/templates.ts),
 * which always creates a draft.
 *
 * No secondary index: a cafe has a handful of templates, read in full and in
 * `order` on the two screens that list them.
 */
export interface IEventTemplate {
  _id: mongoose.Types.ObjectId;
  /** The label on the template's button. */
  nameAr: string;
  nameEn: string;
  kind: EventTemplateKind;
  /** When this usually starts, "HH:mm" in cafe time (`NEXT_PUBLIC_CAFE_TIMEZONE`). */
  defaultTime: string;
  order: number;
  // --- the reusable event fields, same names and limits as `Event` ---
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  locationAr: string;
  locationEn: string;
  mapUrl: string;
  coverImage: string;
  isPoster: boolean;
  price: number;
  capacity: number | null;
  paymentMethods: PaymentMethod[];
  instapayNumber: string;
  termsAr: string;
  termsEn: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventTemplateSchema = new Schema<IEventTemplate>(
  {
    nameAr: { type: String, required: true, trim: true, maxlength: 80 },
    nameEn: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, enum: EVENT_TEMPLATE_KINDS, default: "night" },
    defaultTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      default: "20:00",
    },
    order: { type: Number, default: 0 },
    titleAr: { type: String, required: true, trim: true, maxlength: 160 },
    titleEn: { type: String, required: true, trim: true, maxlength: 160 },
    descriptionAr: { type: String, default: "", maxlength: 4000 },
    descriptionEn: { type: String, default: "", maxlength: 4000 },
    locationAr: { type: String, default: "", maxlength: 240 },
    locationEn: { type: String, default: "", maxlength: 240 },
    mapUrl: { type: String, default: "", maxlength: 800 },
    coverImage: { type: String, default: "", maxlength: 800 },
    isPoster: { type: Boolean, default: false },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, min: 1, default: null },
    paymentMethods: { type: [String], enum: PAYMENT_METHODS, default: ["cash"] },
    instapayNumber: { type: String, default: "", maxlength: 60 },
    termsAr: { type: String, default: "", maxlength: 4000 },
    termsEn: { type: String, default: "", maxlength: 4000 },
  },
  { timestamps: true }
);

export const EventTemplate =
  (models.EventTemplate as mongoose.Model<IEventTemplate>) ||
  model<IEventTemplate>("EventTemplate", EventTemplateSchema);
