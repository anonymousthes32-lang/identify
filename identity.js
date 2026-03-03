const { escapeSqlValue, runSql } = require('./db');

function nowIso() {
  return new Date().toISOString();
}

function normalizeInput(payload) {
  const email = payload.email === null || payload.email === undefined ? null : String(payload.email);
  const phoneNumber = payload.phoneNumber === null || payload.phoneNumber === undefined ? null : String(payload.phoneNumber);

  if (!email && !phoneNumber) {
    throw new Error('Either email or phoneNumber is required');
  }

  return { email, phoneNumber };
}

function getMatches(email, phoneNumber) {
  const filters = [];
  if (email) filters.push(`email = ${escapeSqlValue(email)}`);
  if (phoneNumber) filters.push(`phoneNumber = ${escapeSqlValue(phoneNumber)}`);

  if (!filters.length) return [];

  return runSql(
    `SELECT * FROM Contact
     WHERE deletedAt IS NULL
       AND (${filters.join(' OR ')})
     ORDER BY datetime(createdAt) ASC, id ASC;`,
    { json: true }
  );
}

function fetchGroup(primaryIds) {
  if (!primaryIds.length) return [];
  const ids = primaryIds.join(',');
  return runSql(
    `SELECT * FROM Contact
     WHERE deletedAt IS NULL
       AND (id IN (${ids}) OR linkedId IN (${ids}))
     ORDER BY datetime(createdAt) ASC, id ASC;`,
    { json: true }
  );
}

function chooseWinnerPrimary(group) {
  return group
    .filter((c) => c.linkPrecedence === 'primary')
    .sort((a, b) => {
      if (a.createdAt === b.createdAt) return a.id - b.id;
      return a.createdAt < b.createdAt ? -1 : 1;
    })[0];
}

function buildResponse(group) {
  const primary = group.find((c) => c.linkPrecedence === 'primary');
  const emails = [];
  const phoneNumbers = [];
  const secondaryContactIds = [];

  const appendUnique = (arr, value) => {
    if (value !== null && value !== undefined && !arr.includes(value)) arr.push(value);
  };

  appendUnique(emails, primary.email);
  appendUnique(phoneNumbers, primary.phoneNumber);

  for (const contact of group) {
    if (contact.id !== primary.id) secondaryContactIds.push(contact.id);
    appendUnique(emails, contact.email);
    appendUnique(phoneNumbers, contact.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
}

function createPrimary(email, phoneNumber) {
  const ts = nowIso();
  runSql(
    `INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt)
     VALUES (${escapeSqlValue(phoneNumber)}, ${escapeSqlValue(email)}, NULL, 'primary', ${escapeSqlValue(ts)}, ${escapeSqlValue(ts)}, NULL);`
  );
  return runSql('SELECT * FROM Contact ORDER BY id DESC LIMIT 1;', { json: true })[0];
}

function reconcileIdentity(payload) {
  const { email, phoneNumber } = normalizeInput(payload);
  const matches = getMatches(email, phoneNumber);

  if (!matches.length) {
    const created = createPrimary(email, phoneNumber);
    return buildResponse([created]);
  }

  const rootPrimaryIds = [...new Set(matches.map((row) => (row.linkPrecedence === 'primary' ? row.id : row.linkedId)).filter(Boolean))];
  let group = fetchGroup(rootPrimaryIds);

  const winner = chooseWinnerPrimary(group);
  const demotedIds = group.filter((c) => c.linkPrecedence === 'primary' && c.id !== winner.id).map((c) => c.id);

  if (demotedIds.length) {
    const ts = nowIso();
    const demotedCsv = demotedIds.join(',');
    runSql(`
      BEGIN TRANSACTION;
      UPDATE Contact
      SET linkedId = ${winner.id}, linkPrecedence = 'secondary', updatedAt = ${escapeSqlValue(ts)}
      WHERE id IN (${demotedCsv});

      UPDATE Contact
      SET linkedId = ${winner.id}, updatedAt = ${escapeSqlValue(ts)}
      WHERE linkedId IN (${demotedCsv});
      COMMIT;
    `);
  }

  group = fetchGroup([winner.id]);
  const emailSet = new Set(group.map((c) => c.email).filter(Boolean));
  const phoneSet = new Set(group.map((c) => c.phoneNumber).filter(Boolean));

  const hasNewEmail = email && !emailSet.has(email);
  const hasNewPhone = phoneNumber && !phoneSet.has(phoneNumber);

  if (hasNewEmail || hasNewPhone) {
    const ts = nowIso();
    runSql(
      `INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt)
       VALUES (${escapeSqlValue(phoneNumber)}, ${escapeSqlValue(email)}, ${winner.id}, 'secondary', ${escapeSqlValue(ts)}, ${escapeSqlValue(ts)}, NULL);`
    );
    group = fetchGroup([winner.id]);
  }

  return buildResponse(group);
}

module.exports = {
  reconcileIdentity,
  normalizeInput,
};
