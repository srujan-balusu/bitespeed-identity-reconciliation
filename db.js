const { Pool, Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
const currentDb = dbUrl.split('/').pop().split('?')[0];

const adminClient = new Client({
  connectionString: dbUrl.replace(currentDb, 'postgres'),
});

const dbPool = new Pool({
  connectionString: dbUrl,
});

// Creates the target database if it doesn't exist
const initializeDatabase = async () => {
  try {
    await adminClient.connect();
    const checkDb = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname=$1`, [currentDb]);
    if (checkDb.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${currentDb}`);
      console.log(`Created database: ${currentDb}`);
    } else {
      console.log(`Database "${currentDb}" already exists`);
    }
  } catch (err) {
    console.error("Failed to create database:", err);
  } finally {
    await adminClient.end();
  }
};

// Ensures the schema (contact table) exists
const ensureSchema = async () => {
  const schemaQuery = `
    CREATE TABLE IF NOT EXISTS contact (
      id SERIAL PRIMARY KEY,
      phoneNumber VARCHAR(20),
      email VARCHAR(255),
      linkedId INTEGER REFERENCES contact(id) ON DELETE SET NULL,
      linkPrecedence VARCHAR(10) CHECK (linkPrecedence IN ('primary', 'secondary')) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deletedAt TIMESTAMP NULL
    );
  `;

  try {
    await dbPool.query(schemaQuery);
    console.log("Schema ensured");
  } catch (err) {
    console.error("Error creating schema:", err);
  }
};

module.exports = {
  dbPool,
  initializeDatabase,
  ensureSchema
};
