const express = require("express");
const ai = require("../services/ai");

const router = express.Router();

// just for testing if gemini is working
router.get("/gemini", async (req, res) => {
  const result = await ai.testConnection();
  res.json(result);
});

module.exports = router;
