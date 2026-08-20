import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, type UserRole } from "@/models/User";

/**
 * Emails listed here are promoted to `admin` the first time they sign in. This
 * is the only bootstrap path — after that, roles are managed in the database.
 */
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const staffEmails = (process.env.STAFF_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function bootstrapRole(email: string): UserRole | null {
  if (adminEmails.includes(email)) return "admin";
  if (staffEmails.includes(email)) return "staff";
  return null;
}

/** Which social buttons to render — a provider with no credentials is hidden. */
export const enabledOAuthProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  facebook: Boolean(
    process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
  ),
};

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (credentials) => {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      await connectDB();
      const user = await User.findOne({ email }).select("+passwordHash").lean();
      if (!user?.passwordHash) return null;

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        phone: user.phone,
      };
    },
  }),
];

if (enabledOAuthProviders.google) providers.push(Google);
if (enabledOAuthProviders.facebook) providers.push(Facebook);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers,
  // Credentials sign-in requires JWT sessions; every account type uses the same
  // strategy so role lookups behave identically no matter how someone signed in.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      // Social sign-ins land in the same users collection as email members.
      await connectDB();
      const existing = await User.findOne({ email });
      if (existing) {
        if (!existing.providers.includes(account.provider)) {
          existing.providers.push(account.provider);
        }
        if (user.image && !existing.image) existing.image = user.image;
        const promoted = bootstrapRole(email);
        if (promoted && existing.role !== promoted) existing.role = promoted;
        await existing.save();
      } else {
        await User.create({
          name: user.name ?? email.split("@")[0],
          email,
          image: user.image ?? undefined,
          providers: [account.provider],
          role: bootstrapRole(email) ?? "member",
        });
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      // Refresh identity on sign-in and whenever the client calls update().
      if (user?.email || trigger === "update") {
        const email = (user?.email ?? token.email)?.toLowerCase();
        if (email) {
          await connectDB();
          const dbUser = await User.findOne({ email }).lean();
          if (dbUser) {
            token.sub = String(dbUser._id);
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.picture = dbUser.image;
            token.role = dbUser.role;
            token.phone = dbUser.phone ?? "";
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole) ?? "member";
        session.user.phone = (token.phone as string) ?? "";
      }
      return session;
    },
  },
});
