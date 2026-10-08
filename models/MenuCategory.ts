import mongoose, { Schema, model, models } from "mongoose";

/**
 * A section of the cafe menu — "Hot drinks", "Sweets" (`PLAN/DEKKA_PWA_APP.md`
 * §3). `order` is the admin's own sequence, not alphabetical: a cafe wants hot
 * drinks before snacks whatever they're called.
 *
 * `isActive: false` hides the whole section from guests without deleting it, so
 * a seasonal section can come back next winter with its items intact.
 *
 * No secondary index: the whole collection is a handful of rows, always read
 * in full and sorted in memory by the menu query in `lib/data.ts`.
 */
export interface IMenuCategory {
  _id: mongoose.Types.ObjectId;
  nameAr: string;
  nameEn: string;
  order: number;
  isActive: boolean;
  /**
   * An optional season, Cairo calendar days "YYYY-MM-DD", both inclusive
   * (`PLAN/DEKKA_PWA_APP.md` §5.3, 4b.4): guests see the section only from `startsOn`
   * through `endsOn`. Unset means no limit on that side.
   */
  startsOn?: string;
  endsOn?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MenuCategorySchema = new Schema<IMenuCategory>(
  {
    nameAr: { type: String, required: true, trim: true, maxlength: 80 },
    nameEn: { type: String, required: true, trim: true, maxlength: 80 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsOn: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    endsOn: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true }
);

export const MenuCategory =
  (models.MenuCategory as mongoose.Model<IMenuCategory>) ||
  model<IMenuCategory>("MenuCategory", MenuCategorySchema);
