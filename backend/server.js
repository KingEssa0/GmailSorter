const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const queueService = require("./services/queue");

dotenv.config();

function createApp() {
  const app = express();
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
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

  return app;
}

async function main() {
  await connectDB();

  const app = createApp();

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

  return app;
}

if (require.main === module) {
  main().catch(err => {
    console.error("startup failed:", err);
    process.exit(1);
  });
}

module.exports = { createApp, main };
