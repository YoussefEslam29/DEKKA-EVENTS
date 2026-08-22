import { z } from "zod";
import {
  EVENT_STATUSES,
  PAYMENT_METHODS,
  SUBMISSION_STATUSES,
} from "@/lib/constants";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).optional().default("");

export const registerSchema = z.object({
  name: trimmed(120).min(2),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: trimmed(30).min(6),
  password: z.string().min(8).max(200),
});

const eventCore = {
  titleAr: trimmed(160).min(1),
  titleEn: trimmed(160).min(1),
  descriptionAr: optionalText(4000),
  descriptionEn: optionalText(4000),
  locationAr: optionalText(240),
  locationEn: optionalText(240),
  mapUrl: z.string().trim().max(800).optional().default(""),
  coverImage: z.string().trim().max(800).optional().default(""),
  isPoster: z.boolean().optional().default(false),
  startsAt: z.string().datetime({ offset: true }),
  doorsOpenAt: z.string().datetime({ offset: true }).nullish(),
  price: z.number().min(0).max(1_000_000),
  capacity: z.number().int().min(1).max(100_000).nullish(),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
  instapayNumber: optionalText(60),
  termsAr: optionalText(4000),
  termsEn: optionalText(4000),
  status: z.enum(EVENT_STATUSES).default("draft"),
};

export const createEventSchema = z.object(eventCore);
/** Every field optional — admins save one section of the form at a time. */
export const updateEventSchema = z.object(eventCore).partial();

export const checkInSchema = z.object({
  name: trimmed(120).min(1),
  phone: trimmed(30).min(4),
  paymentMethod: z.enum(PAYMENT_METHODS),
  amount: z.number().min(0).max(1_000_000),
  reservationId: z.string().trim().max(40).optional(),
  note: optionalText(300),
});

export const submissionSchema = z.object({
  bandName: trimmed(160).min(1),
  genre: optionalText(120),
  contactName: trimmed(120).min(1),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: optionalText(30),
  links: z.array(z.string().trim().max(400)).max(10).optional().default([]),
  preferredDates: optionalText(300),
  pitch: optionalText(3000),
});

export const submissionUpdateSchema = z.object({
  status: z.enum(SUBMISSION_STATUSES).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type SubmissionInput = z.infer<typeof submissionSchema>;
