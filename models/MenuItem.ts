import mongoose, { Schema, model, models } from "mongoose";

import { MENU_TAGS, type MenuTag } from "@/lib/constants";

export { MENU_TAGS };
export type { MenuTag };

/** One size or serving of an item — "Small 40 / Large 55", "Hot / Iced". */
export interface IMenuVariant {
  labelAr: string;
  labelEn: string;
  price: number;
}

/**
 * One thing on the cafe menu (`PLAN/DEKKA_PWA_APP.md` §3).
 *
 * Pricing has one rule: an item with `variants` is priced *by* them, and
 * `price` is kept equal to the cheapest variant (enforced in the API routes,
 * not here) so "from 40" and sorting never disagree with what's listed. An item
 * without variants is simply `price`.
 *
 * `available: false` is "sold out tonight": the item stays on the menu, marked,
 * rather than vanishing — the same spirit as an event's status instead of
 * deleting rows. Staff can flip it; nothing else (see the availability route).
 */
export interface IMenuItem {
  _id: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number;
  variants: IMenuVariant[];
  /** Empty, or a URL `POST /api/uploads` returned — never a pasted link. */
  image: string;
  tags: MenuTag[];
  /** "Barista's pick": shown on the homepage strip and badged on the menu. */
  isFeatured: boolean;
  available: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const MenuVariantSchema = new Schema<IMenuVariant>(
  {
    labelAr: { type: String, required: true, trim: true, maxlength: 40 },
    labelEn: { type: String, required: true, trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MenuItemSchema = new Schema<IMenuItem>(
  {
    // No `index: true` here on purpose: the compound index below starts with
    // `category`, so a single-field one would only cost writes — the exact
    // redundancy developer-guide.md §7 found four times on the live cluster.
    category: { type: Schema.Types.ObjectId, ref: "MenuCategory", required: true },
    nameAr: { type: String, required: true, trim: true, maxlength: 120 },
    nameEn: { type: String, required: true, trim: true, maxlength: 120 },
    descriptionAr: { type: String, default: "", maxlength: 500 },
    descriptionEn: { type: String, default: "", maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    variants: { type: [MenuVariantSchema], default: [] },
    image: { type: String, default: "", maxlength: 500 },
    tags: { type: [String], enum: MENU_TAGS, default: [] },
    isFeatured: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// The one real query shape: "this category's items, in the admin's order".
MenuItemSchema.index({ category: 1, order: 1 });

export const MenuItem =
  (models.MenuItem as mongoose.Model<IMenuItem>) ||
  model<IMenuItem>("MenuItem", MenuItemSchema);
