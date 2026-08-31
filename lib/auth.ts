import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Apple from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, type UserRole } from "@/models/User";
import { bootstrapRole } from "@/lib/roles";
import {
  clientIp,
  consumeRateLimit,
  peekRateLimit,
  rateLimit,
} from "@/lib/ratelimit";

/**
 * Thrown when a sign-in attempt is throttled rather than simply wrong.
 *
 * This has to be distinguishable from a bad password: telling someone "invalid
 * credentials" while actually rate limiting them makes them retry harder, which is the
 * opposite of what the limit is for. `AuthForm.tsx` reads the code and shows the
 * "too many attempts" copy instead.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = "RATE_LIMITED";
}

// `ADMIN_EMAILS`/`STAFF_EMAILS` bootstrap lives in `lib/roles.ts` so the
// register route shares exactly this logic — see the note there on which path
// re-applies it to an existing account.

/**
 * Which social buttons to render — a provider with no credentials is hidden, so
 * a half-configured deploy never shows a button that dead-ends.
 *
 * Apple additionally requires a paid Apple Developer Program membership (a
 * Services ID and a signing key); until those exist the button simply does not
 * render rather than failing at the callback.
 */
export const enabledOAuthProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  facebook: Boolean(
    process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
  ),
  apple: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
};

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    authorize: async (credentials, request) => {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      // Rate limiting lives here rather than on the /api/auth/[...nextauth] route
      // Before_Deployment.md §4 named: that route is one catch-all also serving
      // session, CSRF, sign-out and every OAuth callback, so limiting it would
      // throttle far more than sign-in. This function runs exactly once per
      // credentials attempt and has the email in hand. See PLAN/rate-limiting.md §1.
      const ip = clientIp(request);

      // Per-IP: charged on every attempt, since the abuse it stops is one machine
      // spraying many different accounts.
      const byIp = await rateLimit("signin-ip", ip);
      if ("response" in byIp) throw new RateLimitedSignin();

      // Per-email: only *peeked* here. It is charged below, and only when the
      // password turns out to be wrong — otherwise a member signing in on phone and
      // laptop would spend their own allowance on successful logins.
      if (!(await peekRateLimit("signin-email", email))) {
        throw new RateLimitedSignin();
      }

      await connectDB();
      const user = await User.findOne({ email }).select("+passwordHash").lean();
      if (!user?.passwordHash) {
        // Charged for an unknown address too — otherwise the bucket becomes an
        // oracle telling an attacker which emails have accounts.
        await consumeRateLimit("signin-email", email);
        return null;
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        await consumeRateLimit("signin-email", email);
        return null;
      }

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
if (enabledOAuthProviders.apple) providers.push(Apple);

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
