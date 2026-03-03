const { execFileSync } = require('node:child_process');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'identify.db');

function escapeSqlValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runSql(sql, { json = false } = {}) {
  const args = [DB_PATH];
  if (json) args.push('-json');
  args.push(sql);
  const output = execFileSync('sqlite3', args, { encoding: 'utf8' });
  if (!json) return output;
  const trimmed = output.trim();
  return trimmed ? JSON.parse(trimmed) : [];
}

function initDb() {
  runSql(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT NOT NULL CHECK (linkPrecedence IN ('primary', 'secondary')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );
  `);
}

module.exports = {
  DB_PATH,
  escapeSqlValue,
  runSql,
  initDb,
};
