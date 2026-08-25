/**
 * Promote (or demote) one account by email — the supported way to change a
 * role once an account already exists, since `ADMIN_EMAILS`/`STAFF_EMAILS`
 * only apply at account creation on the credentials path.
 *
 *   npx tsx --env-file=.env.local scripts/set-role.ts <email> <member|staff|admin>
 *
 * The person must sign out and back in afterwards: sessions are JWTs, so the
 * role is baked into their token until they get a fresh one.
 */
import dns from "node:dns";
import mongoose from "mongoose";
import { User } from "../models/User";
import { USER_ROLES, type UserRole } from "../lib/constants";

// Matches lib/db.ts: some Windows/router setups hand Node an unreachable
// IPv6 link-local DNS server, which breaks the mongodb+srv SRV lookup.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

async function main() {
  const [email, role] = process.argv.slice(2);

  if (!email || !role) {
    throw new Error(
      "usage: tsx --env-file=.env.local scripts/set-role.ts <email> <member|staff|admin>"
    );
  }
  if (!USER_ROLES.includes(role as UserRole)) {
    throw new Error(`role must be one of: ${USER_ROLES.join(", ")} (got "${role}")`);
  }
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set — check .env.local.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const normalised = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalised });
  if (!user) {
    throw new Error(
      `No account with email "${normalised}". They must sign up first — a role ` +
        `can only be given to an account that already exists.`
    );
  }

  const previous = user.role;
  if (previous === role) {
    console.log(`${normalised} is already "${role}" — nothing to change.`);
  } else {
    user.role = role as UserRole;
    await user.save();
    console.log(`${normalised}: ${previous} → ${role}`);
    console.log("They must sign out and back in for it to take effect.");
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
