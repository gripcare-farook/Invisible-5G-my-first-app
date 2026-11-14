import { PGlite } from "@electric-sql/pglite";
export const testDb = new PGlite();
// Real isolated PostgreSQL (WASM), never reads DATABASE_URL or contacts Neon.
const query = async (sql, params = []) => {
  const result = await testDb.query(sql, params);
  return { ...result, rowCount: result.affectedRows ?? result.rows.length };
};
export const pool = { query, connect: async () => ({ query, release() {} }) };
