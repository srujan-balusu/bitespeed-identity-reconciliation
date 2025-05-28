const { dbPool } = require("../db");

const uniqueNonEmpty = (arr) => [...new Set(arr.filter(Boolean))];

const formatContactResponse = (primaryId, contacts) => {
  const emails = uniqueNonEmpty(contacts.map(c => c.email));
  const phones = uniqueNonEmpty(contacts.map(c => c.phonenumber));
  const secondaryIds = contacts
    .filter(c => c.linkprecedence === "secondary")
    .map(c => c.id);

  return {
    primaryContatctId: primaryId,
    emails,
    phoneNumbers: phones,
    secondaryContactIds: secondaryIds
  };
};

const identifyContact = async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "Email or phoneNumber is required" });
  }

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: matches } = await client.query(
      `SELECT * FROM contact WHERE email = $1 OR phoneNumber = $2 ORDER BY createdAt ASC`,
      [email, phoneNumber]
    );

    if (matches.length === 0) {
      const { rows } = await client.query(
        `INSERT INTO contact (email, phoneNumber, linkPrecedence, createdAt, updatedAt)
         VALUES ($1, $2, 'primary', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [email, phoneNumber]
      );

      const newContact = rows[0];
      await client.query("COMMIT");

      return res.status(200).json({
        contact: formatContactResponse(newContact.id, [newContact])
      });
    }

    const primary = matches.find(c => c.linkprecedence === "primary") || matches[0];
    const primaryId = primary.id;

    for (const c of matches) {
      if (c.linkprecedence === "primary" && c.id !== primaryId) {
        await client.query(
          `UPDATE contact
           SET linkPrecedence = 'secondary', linkedId = $1, updatedAt = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [primaryId, c.id]
        );
      }
    }

    const existingEmails = matches.map(c => c.email);
    const existingPhones = matches.map(c => c.phonenumber);

    const isNewEmail = email && !existingEmails.includes(email);
    const isNewPhone = phoneNumber && !existingPhones.includes(phoneNumber);

    if (isNewEmail || isNewPhone) {
      await client.query(
        `INSERT INTO contact (email, phoneNumber, linkPrecedence, linkedId, createdAt, updatedAt)
         VALUES ($1, $2, 'secondary', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [email, phoneNumber, primaryId]
      );
    }

    const { rows: allLinked } = await client.query(
      `SELECT * FROM contact
       WHERE id = $1 OR linkedId = $1 OR linkedId IN (
         SELECT id FROM contact WHERE linkedId = $1
       )
       ORDER BY createdAt ASC`,
      [primaryId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      contact: formatContactResponse(primaryId, allLinked)
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Identify error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

module.exports = { identifyContact };
