import mongoose, { Schema, model, models } from "mongoose";

import {
  EVENT_STATUSES,
  PAYMENT_METHODS,
  type EventStatus,
  type PaymentMethod,
} from "@/lib/constants";

export { EVENT_STATUSES, PAYMENT_METHODS };
export type { EventStatus, PaymentMethod };

/**
 * Where this event's "Show on PDF" report lives once it has been generated
 * once. Set by `POST /api/events/:id/report`; a second click refreshes the
 * same Sheet and PDF in place instead of creating new ones (Admin_Event_PDF.md
 * §4 / §9). All optional — absent until the first successful generation.
 */
export interface IEventReport {
  /** Google Sheets file id, for the values/formatting refresh calls. */
  spreadsheetId: string;
  /** Ready-to-open `https://docs.google.com/spreadsheets/d/…` link. */
  spreadsheetUrl: string;
  /** Google Drive file id of the PDF, for the in-place media refresh. */
  pdfFileId: string;
  /** Drive `webViewLink` for the PDF. */
  pdfUrl: string;
  /** When the report was last (re)generated. */
  generatedAt: Date;
}

export interface IEvent {
  _id: mongoose.Types.ObjectId;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  locationAr: string;
  locationEn: string;
  mapUrl?: string;
  coverImage?: string;
  /** Cover image already has its own title/date drawn on it — render it as pure artwork. */
  isPoster: boolean;
  startsAt: Date;
  doorsOpenAt?: Date;
  price: number;
  /** null / undefined means unlimited — the event never goes "Full". */
  capacity?: number | null;
  paymentMethods: PaymentMethod[];
  instapayNumber?: string;
  termsAr?: string;
  termsEn?: string;
  status: EventStatus;
  report?: IEventReport | null;
  createdAt: Date;
  updatedAt: Date;
}

const EventReportSchema = new Schema<IEventReport>(
  {
    spreadsheetId: { type: String, default: "" },
    spreadsheetUrl: { type: String, default: "" },
    pdfFileId: { type: String, default: "" },
    pdfUrl: { type: String, default: "" },
    generatedAt: { type: Date },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    titleAr: { type: String, required: true, trim: true, maxlength: 160 },
    titleEn: { type: String, required: true, trim: true, maxlength: 160 },
    descriptionAr: { type: String, default: "", maxlength: 4000 },
    descriptionEn: { type: String, default: "", maxlength: 4000 },
    locationAr: { type: String, default: "", maxlength: 240 },
    locationEn: { type: String, default: "", maxlength: 240 },
    mapUrl: { type: String, maxlength: 800 },
    coverImage: { type: String, maxlength: 800 },
    isPoster: { type: Boolean, default: false },
    startsAt: { type: Date, required: true, index: true },
    doorsOpenAt: { type: Date },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, min: 1, default: null },
    paymentMethods: {
      type: [String],
      enum: PAYMENT_METHODS,
      default: ["cash"],
    },
    instapayNumber: { type: String, maxlength: 60 },
    termsAr: { type: String, default: "", maxlength: 4000 },
    termsEn: { type: String, default: "", maxlength: 4000 },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: "draft",
      index: true,
    },
    report: { type: EventReportSchema, default: null },
  },
  { timestamps: true }
);

// The events hub always queries "published, soonest first".
EventSchema.index({ status: 1, startsAt: 1 });

export const Event =
  (models.Event as mongoose.Model<IEvent>) || model<IEvent>("Event", EventSchema);
