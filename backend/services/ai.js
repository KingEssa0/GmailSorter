const Groq = require("groq-sdk");
const cheerio = require("cheerio");
require("dotenv").config();

const MODEL = "llama-3.1-8b-instant";

function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function callGroq(prompt) {
  const client = getClient();
  if (!client) throw new Error("No GROQ_API_KEY set");

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
  });

  return completion.choices[0]?.message?.content || "";
}

class AIService {
  async categorizeEmail(emailData, categories) {
    if (!process.env.GROQ_API_KEY) return null;

    const categoryList = categories.map(c => `${c.name}: ${c.description}`).join("\n");

    const prompt = `Which of these categories best fits this email? Respond with only the category name, nothing else.

Email Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${(emailData.body || "").substring(0, 1000)}

Categories:
${categoryList}`;

    try {
      const name = (await callGroq(prompt)).trim();
      return categories.find(c => c.name.toLowerCase() === name.toLowerCase())
        || categories.find(c => name.toLowerCase().includes(c.name.toLowerCase()))
        || categories.find(c => c.name.toLowerCase().includes(name.toLowerCase()))
        || null;
    } catch (err) {
      console.error("categorize error:", err.message);
      return null;
    }
  }

  async summarizeEmail(emailData) {
    if (!process.env.GROQ_API_KEY) return "AI service unavailable";

    let body = emailData.body || "";
    if (body.includes("<")) {
      try {
        const $ = cheerio.load(body);
        body = $.text();
      } catch (e) {}
    }

    const prompt = `Summarize this email in 1-2 sentences. Focus on what action is needed or what the main point is.

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${body.substring(0, 2000)}`;

    try {
      return (await callGroq(prompt)).trim();
    } catch (err) {
      console.error("summarize error:", err.message);
      return "Summary unavailable";
    }
  }

  extractUnsubscribeLink(body) {
    if (!body) return null;

    try {
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
    if (!process.env.GROQ_API_KEY) {
      return { success: false, error: "No GROQ_API_KEY set" };
    }
    try {
      const text = await callGroq("Say hello in one word");
      return { success: true, response: text.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new AIService();
