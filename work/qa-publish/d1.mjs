import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function memoryD1(directory) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(directory).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, directory), 'utf8'));
  }
  class Statement {
    constructor(sql, values = []) { this.sql = sql; this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    first(field) {
      const row = db.prepare(this.sql).get(...this.values);
      return (field ? row?.[field] : row) ?? null;
    }
    all() { return {results: db.prepare(this.sql).all(...this.values)}; }
    run() {
      const sql = db.prepare(this.sql);
      const results = sql.all(...this.values);
      const {changes, last_row_id} = db.prepare('SELECT changes() AS changes,last_insert_rowid() AS last_row_id').get();
      return {success:true, results, meta:{changes, last_row_id}};
    }
  }
  return {
    prepare(sql) { return new Statement(sql); },
    batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(s => s.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() { db.close(); },
  };
}
