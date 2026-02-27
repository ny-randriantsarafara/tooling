import { createDatabase } from "./client.js";

const databasePath = process.argv[2] ?? "runs.db";
const database = createDatabase(databasePath);
database.close();
console.log(`Database migrated: ${databasePath}`);
