const aiService = require("../services/ai");
require("dotenv").config();

async function testAIService() {
  console.log("=== Testing AI Service ===\n");

  // Test 1: Connection
  console.log("1. Testing Gemini connection...");
  const connectionTest = await aiService.testConnection();
  console.log("Result:", connectionTest);
  console.log();

  // Test 2: Categorization
  console.log("2. Testing email categorization...");
  const mockEmail = {
    subject: "Meeting tomorrow at 3pm",
    from: "boss@company.com",
    body: "Hi, let's discuss the Q1 results in the conference room."
  };

  const mockCategories = [
    { name: "Work", description: "Professional and work-related emails" },
    { name: "Personal", description: "Personal emails from friends and family" }
  ];

  try {
    const category = await aiService.categorizeEmail(mockEmail, mockCategories);
    console.log("Categorized as:", category.name);
  } catch (error) {
    console.error("Categorization error:", error.message);
  }
  console.log();

  // Test 3: Summarization
  console.log("3. Testing email summarization...");
  try {
    const summary = await aiService.summarizeEmail(mockEmail);
    console.log("Summary:", summary);
  } catch (error) {
    console.error("Summarization error:", error.message);
  }
}

testAIService();
