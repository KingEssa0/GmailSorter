const express = require("express");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Account = require("../models/Account");
const auth = require("../middleware/auth");

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

router.get("/google", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    let user = await User.findOne({ googleId: data.id });

    if (!user) {
      user = new User({
        googleId: data.id,
        email: data.email,
        name: data.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      await user.save();

      await Account.create({
        userId: user._id,
        email: data.email,
        googleId: data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isPrimary: true,
        isActive: true,
      });
    } else {
      user.accessToken = tokens.access_token;
      if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
      await user.save();

      const existing = await Account.findOne({ userId: user._id, email: data.email });
      if (existing) {
        existing.accessToken = tokens.access_token;
        if (tokens.refresh_token) existing.refreshToken = tokens.refresh_token;
        existing.isActive = true;
        await existing.save();
      } else {
        await Account.create({
          userId: user._id,
          email: data.email,
          googleId: data.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isPrimary: true,
          isActive: true,
        });
      }
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (err) {
    console.error("auth callback error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user._id, isActive: true }).select("email isPrimary");
    res.json({
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      accounts,
    });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch user data" });
  }
});

module.exports = router;
