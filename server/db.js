// Cloudflare D1 adapter used by the existing Novly route layer.
// D1 is asynchronous, so all database calls in routes await these methods.
function runtimeEnv() {
  const env = globalThis.__NOVLY_CF_ENV;
  if (!env?.DB) throw new Error('Cloudflare D1 binding DB is not available.');
  return env;
}

function normalizeBindings(values) {
  return values.map((v) => v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

class Statement {
  constructor(sql) { this.sql = sql; }
  _bound(values) {
    const stmt = runtimeEnv().DB.prepare(this.sql);
    return values.length ? stmt.bind(...normalizeBindings(values)) : stmt;
  }
  async get(...values) {
    return (await this._bound(values).first()) || undefined;
  }
  async all(...values) {
    const result = await this._bound(values).all();
    return result.results || [];
  }
  async run(...values) {
    const result = await this._bound(values).run();
    return {
      changes: Number(result?.meta?.changes || 0),
      lastInsertRowid: Number(result?.meta?.last_row_id || 0),
      success: result?.success !== false,
      meta: result?.meta || {},
    };
  }
  // Return a lightweight batch descriptor; db.batch() binds it to the active D1 database.
  bind(...values) { return { sql: this.sql, values }; }
  bound(...values) { return this._bound(values); }
}

const db = {
  prepare(sql) { return new Statement(sql); },
  async exec(sql) {
    return runtimeEnv().DB.exec(sql);
  },
  async batch(items) {
    const statements = items.map((item) => {
      if (item instanceof Statement) return item.bound();
      if (!item || typeof item.sql !== 'string') throw new TypeError('Invalid D1 batch item');
      return new Statement(item.sql).bound(...(item.values || []));
    });
    return runtimeEnv().DB.batch(statements);
  },
  item(sql, ...values) { return { sql, values }; },
  env: runtimeEnv,
};

module.exports = db;
