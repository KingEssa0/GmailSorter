require("dotenv").config();

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Account = require("../models/Account");
const User = require("../models/User");
const authRouter = require("../routes/auth");

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

describe("Auth Routes", () => {
  let mongoServer;
  let validToken;
  let testUser;
  let testAccount;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Account.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: "cathy@example.com",
      name: "Cathy N.",
      googleId: "cathy-google-id",
      accessToken: "cathy-access-token",
      refreshToken: "cathy-refresh-token",
    });

    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Create primary account for test user
    testAccount = await Account.create({
      userId: testUser._id,
      email: "cathy@example.com",
      googleId: "cathy-google-id",
      accessToken: "cathy-access-token",
      refreshToken: "cathy-refresh-token",
      isPrimary: true,
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe("GET /api/auth/google", () => {
    it("should redirect to Google OAuth URL", async () => {
      const response = await request(app).get("/api/auth/google");

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain("accounts.google.com");
      expect(response.headers.location).toContain("oauth2");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user data with accounts when authenticated", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testUser._id.toString(),
        email: "cathy@example.com",
        name: "Cathy N.",
      });

      expect(response.body.accounts).toHaveLength(1);
      expect(response.body.accounts[0]).toMatchObject({
        email: "cathy@example.com",
        isPrimary: true,
      });

      expect(response.body).not.toHaveProperty("accessToken");
      expect(response.body).not.toHaveProperty("refreshToken");
    });

    it("should return 401 when no authorization token provided", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "msg",
        "No token, authorization denied"
      );
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("msg", "Token is not valid");
    });

    it("should only return active accounts in user data", async () => {
      // Create an inactive secondary account
      await Account.create({
        userId: testUser._id,
        email: "cathy.archive@example.com",
        googleId: "cathy-archive-google-id",
        accessToken: "cathy-archive-access-token",
        refreshToken: "cathy-archive-refresh-token",
        isPrimary: false,
        isActive: false,
      });

      // Create an active secondary account
      await Account.create({
        userId: testUser._id,
        email: "cathy.work@example.com",
        googleId: "cathy-work-google-id",
        accessToken: "cathy-work-access-token",
        refreshToken: "cathy-work-refresh-token",
        isPrimary: false,
        isActive: true,
      });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.accounts).toHaveLength(2);

      const emails = response.body.accounts.map((acc) => acc.email);
      expect(emails).toContain("cathy@example.com");
      expect(emails).toContain("cathy.work@example.com");
      expect(emails).not.toContain("cathy.archive@example.com");
    });

    it("should return user data with empty accounts array when user has no active accounts", async () => {
      // Deactivate the primary account
      await Account.findByIdAndUpdate(testAccount._id, { isActive: false });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testUser._id.toString(),
        email: "cathy@example.com",
        name: "Cathy N.",
      });
      expect(response.body.accounts).toHaveLength(0);
    });

    it("should return 401 when token contains non-existent user", async () => {
      const invalidUserId = new mongoose.Types.ObjectId();
      const invalidToken = jwt.sign(
        { userId: invalidUserId },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("msg", "User not found");
    });
  });
});
