const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const queueService = require("./services/queue");

dotenv.config();

async function main() {
  await connectDB();

  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }));
  app.use(express.json());

  app.use("/api/auth", require("./routes/auth"));
  app.use("/auth", require("./routes/auth"));
  app.use("/api/categories", require("./routes/categories"));
  app.use("/api/emails", require("./routes/emails"));
  app.use("/api/test", require("./routes/test"));
  app.use("/api/accounts", require("./routes/accounts"));

  app.get("/", (req, res) => {
    res.json({ message: "Gmail Sorter API is running!" });
  });

  // try to start the queue, but if redis isnt running just skip it
  try {
    await queueService.scheduleAutoSync();
    console.log("queue started");
  } catch (err) {
    console.warn("Redis not available, auto-sync disabled:", err.message);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`server on port ${PORT}`);
  });
}

main().catch(err => {
  console.error("startup failed:", err);
  process.exit(1);
});
