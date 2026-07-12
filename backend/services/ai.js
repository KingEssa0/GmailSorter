const { GoogleGenerativeAI } = require("@google/generative-ai");
const cheerio = require("cheerio");
require("dotenv").config();

class AIService {
  constructor() {
    this.gemini = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    this.model = "gemini-2.5-flash";
  }

  async categorizeEmail(emailData, categories) {
    if (!this.gemini) return null;

    const model = this.gemini.getGenerativeModel({ model: this.model });

    const categoryList = categories.map(c => `${c.name}: ${c.description}`).join("\n");

    const prompt = `Which of these categories best fits this email? Respond with only the category name.

Email Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body.substring(0, 1000)}

Categories:
${categoryList}`;

    try {
      const result = await model.generateContent(prompt);
      const name = result.response.text().trim();
      return categories.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
    } catch (err) {
      console.error("categorize error:", err);
      return null;
    }
  }

  async summarizeEmail(emailData) {
    if (!this.gemini) return "AI service unavailable";

    let body = emailData.body;

    // strip html if needed
    if (body.includes("<")) {
      try {
        const $ = cheerio.load(body);
        body = $.text();
      } catch (e) {
        console.error("cheerio error:", e);
      }
    }

    const model = this.gemini.getGenerativeModel({ model: this.model });

    const prompt = `Summarize this email in 1-2 sentences. Focus on what action is needed or what the main point is.

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${body.substring(0, 2000)}`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      console.error("summarize error:", err);
      return "Summary unavailable";
    }
  }

  extractUnsubscribeLink(body) {
    if (!body) return null;

    try {
      // try html parsing first
      if (body.includes("<")) {
        try {
          const $ = cheerio.load(body);
          const selectors = [
            'a[href*="unsubscribe" i]',
            'a[href*="opt-out" i]',
            'a[href*="remove" i]',
            'a[href*="preferences" i]',
            'a:contains("unsubscribe")',
            'a:contains("opt out")',
            'a:contains("remove me")',
            'a:contains("manage preferences")',
          ];

          for (const sel of selectors) {
            const link = $(sel).first();
            if (link.length > 0) {
              const href = link.attr("href");
              if (href?.startsWith("http")) return href;
              if (href?.startsWith("//")) return "https:" + href;
            }
          }
        } catch (e) {}
      }

      // fallback to regex
      const patterns = [
        /https?:\/\/[^\s<>"'\)]+unsubscribe[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+opt[_-]?out[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+remove[^\s<>"'\)]*/gi,
        /https?:\/\/[^\s<>"'\)]+preferences[^\s<>"'\)]*/gi,
      ];

      for (const pattern of patterns) {
        const matches = body.match(pattern);
        if (matches?.length > 0) return matches[0];
      }

      return null;
    } catch (err) {
      console.error("extract link error:", err);
      return null;
    }
  }

  async testConnection() {
    if (!this.gemini) return { success: false, error: "Gemini not initialized - check GEMINI_API_KEY" };

    try {
      const model = this.gemini.getGenerativeModel({ model: this.model });
      const result = await model.generateContent("Say hello");
      return { success: true, response: result.response.text().trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new AIService();
