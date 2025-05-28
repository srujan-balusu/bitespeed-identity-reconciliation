const express = require("express");
const dotenv = require("dotenv");
const contactRouter = require("./routes/identify");
const { initializeDatabase, ensureSchema } = require("./db");

dotenv.config();
const app = express();

app.use(express.json());

const launchServer = async () => {
  await initializeDatabase();
  await ensureSchema();

  app.use("/", contactRouter);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is live on http://localhost:${PORT}`);
  });
};

launchServer();
