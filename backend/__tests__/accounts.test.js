require("dotenv").config();

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Account = require("../models/Account");
const User = require("../models/User");
const accountsRouter = require("../routes/accounts");

const app = express();
app.use(express.json());
app.use("/api/accounts", accountsRouter);

describe("Accounts Routes", () => {
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
    await Account.deleteMany({});
    if (mongoose.models.User) {
      await mongoose.models.User.deleteMany({});
    }

    // Create test user
    testUser = await mongoose.models.User.create({
      email: "cathy.k@example.com",
      name: "Cathy K.",
      googleId: "cathy-google-id",
      accessToken: "cathy-access-token",
      refreshToken: "cathy-refresh-token",
    });

    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Create test account
    testAccount = await Account.create({
      userId: testUser._id,
      email: "cathy.k@example.com",
      googleId: "cathy-google-id",
      accessToken: "cathy-access-token",
      refreshToken: "cathy-refresh-token",
      isPrimary: true,
      isActive: true,
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe("GET /api/accounts/", () => {
    it("should return user accounts when authenticated", async () => {
      const response = await request(app)
        .get("/api/accounts/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        email: "cathy.k@example.com",
        isPrimary: true,
      });
      expect(response.body[0]).toHaveProperty("createdAt");
      expect(response.body[0]).not.toHaveProperty("accessToken");
      expect(response.body[0]).not.toHaveProperty("refreshToken");
    });

    it("should return 401 when no authorization token provided", async () => {
      const response = await request(app).get("/api/accounts/");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "msg",
        "No token, authorization denied"
      );
    });

    it("should return 401 when invalid token provided", async () => {
      const response = await request(app)
        .get("/api/accounts/")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("msg", "Token is not valid");
    });

    it("should return empty array when user has no active accounts", async () => {
      await Account.findByIdAndUpdate(testAccount._id, { isActive: false });

      const response = await request(app)
        .get("/api/accounts/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it("should sort accounts by isPrimary first, then by createdAt", async () => {
      const secondaryAccount = await Account.create({
        userId: testUser._id,
        email: "cathy.alt@example.com",
        googleId: "cathy-alt-google-id",
        accessToken: "cathy-alt-access-token",
        refreshToken: "cathy-alt-refresh-token",
        isPrimary: false,
        isActive: true,
      });

      const response = await request(app)
        .get("/api/accounts/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].isPrimary).toBe(true);
      expect(response.body[1].isPrimary).toBe(false);
    });
  });

  describe("DELETE /api/accounts/:accountId", () => {
    let secondaryAccount;

    beforeEach(async () => {
      secondaryAccount = await Account.create({
        userId: testUser._id,
        email: "cathy.alt@example.com",
        googleId: "cathy-alt-google-id",
        accessToken: "cathy-alt-access-token",
        refreshToken: "cathy-alt-refresh-token",
        isPrimary: false,
        isActive: true,
      });
    });

    it("should successfully delete a secondary account", async () => {
      const response = await request(app)
        .delete(`/api/accounts/${secondaryAccount._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        msg: "Account disconnected successfully",
        emailsDeleted: 0,
        accountEmail: "cathy.alt@example.com",
      });

      const deletedAccount = await Account.findById(secondaryAccount._id);
      expect(deletedAccount).toBeNull();
    });

    it("should return 404 when account not found", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/accounts/${nonExistentId}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("msg", "Account not found");
    });

    it("should return 400 when trying to delete primary account", async () => {
      const response = await request(app)
        .delete(`/api/accounts/${testAccount._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "msg",
        "Cannot disconnect primary account"
      );

      const primaryAccount = await Account.findById(testAccount._id);
      expect(primaryAccount).toBeTruthy();
    });

    it("should allow deletion of secondary accounts but not primary account", async () => {
      const response = await request(app)
        .delete(`/api/accounts/${secondaryAccount._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        msg: "Account disconnected successfully",
        emailsDeleted: 0,
        accountEmail: "cathy.alt@example.com",
      });

      const deletedAccount = await Account.findById(secondaryAccount._id);
      expect(deletedAccount).toBeNull();

      const primaryAccount = await Account.findById(testAccount._id);
      expect(primaryAccount).toBeTruthy();
    });

    it("should return 401 when no authorization token provided", async () => {
      const response = await request(app).delete(
        `/api/accounts/${secondaryAccount._id}`
      );

      expect(response.status).toBe(401);
    });

    it("should return 404 when trying to delete another user's account", async () => {
      const anotherUserId = new mongoose.Types.ObjectId();
      const anotherUserAccount = await Account.create({
        userId: anotherUserId,
        email: "another@example.com",
        googleId: "another-google-id",
        accessToken: "another-access-token",
        refreshToken: "another-refresh-token",
        isPrimary: false,
        isActive: true,
      });

      const response = await request(app)
        .delete(`/api/accounts/${anotherUserAccount._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("msg", "Account not found");
    });
  });
});
