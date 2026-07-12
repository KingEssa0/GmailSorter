const express = require("express");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Account = require("../models/Account");
const Email = require("../models/Email");
const Category = require("../models/Category");
const auth = require("../middleware/auth");

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/api/accounts/connect/callback`
);

// needed this separate from normal auth because the token comes in the query string
// during the oauth redirect flow
const flexibleAuth = (req, res, next) => {
  let token = req.header("Authorization");
  if (token?.startsWith("Bearer ")) {
    token = token.slice(7);
  } else {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ msg: "no token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (decoded.userId) req.user._id = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ msg: "invalid token" });
  }
};

router.get("/", auth, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user._id, isActive: true })
      .select("email isPrimary createdAt")
      .sort({ isPrimary: -1, createdAt: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch accounts" });
  }
});

router.get("/connect", flexibleAuth, (req, res) => {
  if (!req.user?._id) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=authentication_required`);
  }

  const state = jwt.sign(
    { userId: req.user._id.toString(), purpose: "connect_additional", timestamp: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    prompt: "consent",
    state,
  });

  res.redirect(url);
});

router.get("/connect/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=oauth_error`);
  if (!state || !code) return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=missing_parameters`);

  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);

    if (!decoded || decoded.purpose !== "connect_additional" || !decoded.userId) {
      throw new Error("bad state token");
    }

    const userId = new mongoose.Types.ObjectId(decoded.userId);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const existing = await Account.findOne({ userId, email: data.email });

    if (existing) {
      existing.accessToken = tokens.access_token;
      if (tokens.refresh_token) existing.refreshToken = tokens.refresh_token;
      existing.isActive = true;
      await existing.save();
    } else {
      await Account.create({
        userId,
        email: data.email,
        googleId: data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isPrimary: false,
        isActive: true,
      });
    }

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?connected=success`);
  } catch (err) {
    const isExpired = err.name === "TokenExpiredError" || err.message.includes("state token");
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=${isExpired ? "session_expired" : "connection_failed"}`);
  }
});

router.delete("/:accountId", auth, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.accountId, userId: req.user._id });

    if (!account) return res.status(404).json({ msg: "Account not found" });
    if (account.isPrimary) return res.status(400).json({ msg: "Cannot disconnect primary account" });

    const deleted = await Email.deleteMany({ accountId: req.params.accountId, userId: req.user._id });

    // recalculate email counts for all categories
    const categories = await Category.find({ userId: req.user._id });
    for (const cat of categories) {
      const count = await Email.countDocuments({ userId: req.user._id, categoryId: cat._id });
      await Category.findByIdAndUpdate(cat._id, { emailCount: count });
    }

    await Account.findByIdAndDelete(req.params.accountId);

    res.json({
      msg: "Account disconnected",
      emailsDeleted: deleted.deletedCount,
      accountEmail: account.email,
    });
  } catch (err) {
    res.status(500).json({ msg: "Failed to disconnect account" });
  }
});

module.exports = router;
