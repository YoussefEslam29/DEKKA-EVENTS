import dns from "node:dns";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db!;
  console.log("DB:", db.databaseName);
  const cols = await db.listCollections().toArray();
  console.log("Collections:", cols.map((c) => c.name));
  const users = await db.collection("users").find({}).project({ email: 1, role: 1, passwordHash: 1 }).toArray();
  console.log("User count:", users.length);
  for (const u of users) {
    console.log(` - ${u.email} | role=${u.role} | hasPassword=${Boolean(u.passwordHash)}`);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
