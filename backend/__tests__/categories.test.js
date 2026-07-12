require("dotenv").config();

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Category = require("../models/Category");
const User = require("../models/User");
const Email = require("../models/Email");
const categoriesRouter = require("../routes/categories");

const app = express();
app.use(express.json());
app.use("/api/categories", categoriesRouter);

describe("Categories Routes", () => {
  let mongoServer;
  let validToken;
  let testUser;
  let testCategory;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    if (mongoose.models.Email) {
      await mongoose.models.Email.deleteMany({});
    }

    // Create test user
    testUser = await User.create({
      email: "cathy.k@example.com",
      name: "Cathy K.",
      googleId: "cathy-google-id",
      accessToken: "cathy-access-token",
      refreshToken: "cathy-refresh-token",
    });

    validToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Create test category
    testCategory = await Category.create({
      userId: testUser._id,
      name: "Work",
      description: "Work-related emails",
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe("GET /api/categories/", () => {
    it("should return user categories with email counts when authenticated", async () => {
      const response = await request(app)
        .get("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        name: "Work",
        description: "Work-related emails",
        emailCount: 0,
      });
      expect(response.body[0]).toHaveProperty("_id");
      expect(response.body[0]).toHaveProperty("createdAt");
    });

    it("should return 401 when no authorization token provided", async () => {
      const response = await request(app).get("/api/categories/");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty(
        "msg",
        "No token, authorization denied"
      );
    });

    it("should return empty array when user has no categories", async () => {
      // Delete the test category
      await Category.findByIdAndDelete(testCategory._id);

      const response = await request(app)
        .get("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it("should return correct email counts for categories", async () => {
      const personalCategory = await Category.create({
        userId: testUser._id,
        name: "Personal",
        description: "Personal emails",
      });

      if (mongoose.models.Email) {
        // Create mock emails
        await mongoose.models.Email.create({
          userId: testUser._id,
          categoryId: testCategory._id,
          subject: "Project Update - Kimani Farms",
          from: "cathy@kimanisolutions.com",
          sender: "cathy@kimanisolutions.com",
          body: "Here's the latest update on the Kimani Farms automation rollout.",
          gmailId: "email-kimani-update-1",
          aiSummary: "Update on the automation rollout at Kimani Farms.",
          accountId: new mongoose.Types.ObjectId(),
        });

        await mongoose.models.Email.create({
          userId: testUser._id,
          categoryId: testCategory._id,
          subject: "Client Inquiry - Catherine Supplies",
          from: "inquiry@catherinesupplies.com",
          sender: "inquiry@catherinesupplies.com",
          body: "We'd like to get a quote for smart sensors in our Nairobi store.",
          gmailId: "email-client-inquiry-2",
          aiSummary:
            "Client request for smart sensor pricing at Nairobi branch.",
          accountId: new mongoose.Types.ObjectId(),
        });
      }

      const response = await request(app)
        .get("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      const workCategory = response.body.find((cat) => cat.name === "Work");
      const personalCategoryResponse = response.body.find(
        (cat) => cat.name === "Personal"
      );

      if (mongoose.models.Email) {
        expect(workCategory.emailCount).toBe(2);
        expect(personalCategoryResponse.emailCount).toBe(0);
      } else {
        expect(workCategory.emailCount).toBe(0);
        expect(personalCategoryResponse.emailCount).toBe(0);
      }
    });

    it("should only return categories belonging to authenticated user", async () => {
      const katUser = await User.create({
        email: "kat.k@example.com",
        name: "Kat K.",
        googleId: "kat-google-id",
        accessToken: "kat-access-token",
        refreshToken: "kat-refresh-token",
      });

      await Category.create({
        userId: katUser._id,
        name: "Kat’s Hidden",
        description: "Should not appear",
      });

      const response = await request(app)
        .get("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Work");
    });
  });

  describe("POST /api/categories/", () => {
    it("should create a new category when authenticated", async () => {
      const newCategory = {
        name: "Shopping",
        description: "Online shopping receipts and confirmations",
      };

      const response = await request(app)
        .post("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`)
        .send(newCategory);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: "Shopping",
        description: "Online shopping receipts and confirmations",
        userId: testUser._id.toString(),
        emailCount: 0,
      });
      expect(response.body).toHaveProperty("_id");
      expect(response.body).toHaveProperty("createdAt");

      const savedCategory = await Category.findById(response.body._id);
      expect(savedCategory).toBeTruthy();
      expect(savedCategory.name).toBe("Shopping");
    });

    it("should return 401 when no authorization token provided", async () => {
      const newCategory = {
        name: "Test Category",
        description: "Test description",
      };

      const response = await request(app)
        .post("/api/categories/")
        .send(newCategory);

      expect(response.status).toBe(401);
    });

    it("should return 500 when required fields are missing", async () => {
      const invalidCategory = {
        name: "Missing Description",
      };

      const response = await request(app)
        .post("/api/categories/")
        .set("Authorization", `Bearer ${validToken}`)
        .send(invalidCategory);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty("msg", "Server error");
    });
  });

  describe("DELETE /api/categories/:id", () => {
    it("should delete category when authenticated and category belongs to user", async () => {
      const response = await request(app)
        .delete(`/api/categories/${testCategory._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("msg", "Category deleted");

      const deletedCategory = await Category.findById(testCategory._id);
      expect(deletedCategory).toBeNull();
    });

    it("should return 401 when no authorization token provided", async () => {
      const response = await request(app).delete(
        `/api/categories/${testCategory._id}`
      );

      expect(response.status).toBe(401);
    });

    it("should not delete category belonging to another user", async () => {
      const katUser = await User.create({
        email: "kat.k@example.com",
        name: "Kat K.",
        googleId: "kat-google-id",
        accessToken: "kat-access-token",
        refreshToken: "kat-refresh-token",
      });

      const katCategory = await Category.create({
        userId: katUser._id,
        name: "Kat’s Primary",
        description: "Should not be deletable",
      });

      const response = await request(app)
        .delete(`/api/categories/${katCategory._id}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("msg", "Category not found");

      const stillExists = await Category.findById(katCategory._id);
      expect(stillExists).toBeTruthy();
    });

    it("should return 404 when category does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/categories/${nonExistentId}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("msg", "Category not found");
    });
  });
});
