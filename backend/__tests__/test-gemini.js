const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGemini() {
  console.log("=== Gemini API Test ===");
  console.log("API Key present:", !!process.env.GEMINI_API_KEY);
  console.log("API Key (first 10 chars):", process.env.GEMINI_API_KEY?.substring(0, 10));
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found in environment");
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("GoogleGenerativeAI client initialized");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    console.log("Model instance created");

    console.log("\nTesting generateContent...");
    const result = await model.generateContent("Say hello in one word");
    const response = await result.response;
    const text = response.text();
    
    console.log("SUCCESS!");
    console.log("Response:", text);
    
  } catch (error) {
    console.error("ERROR:", error.message);
    console.error("\nFull error details:");
    console.error(error);
  }
}

testGemini();
