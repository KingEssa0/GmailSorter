const mongoose = require("mongoose");

// had dns issues without this
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("mongodb connected");
  } catch (err) {
    console.error("db connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
