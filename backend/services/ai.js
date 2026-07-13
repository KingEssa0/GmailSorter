const Groq = require("groq-sdk");
const cheerio = require("cheerio");
require("dotenv").config();

const MODEL = "llama-3.1-8b-instant";
let _client = null;

function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _client;
}

async function callGroq(prompt, maxTokens = 200) {
  const client = getClient();
  if (!client) throw new Error("No GROQ_API_KEY set");
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content || "";
}

function stripHtml(body) {
  if (!body) return "";
  if (!body.includes("<")) return body;
  try {
    const $ = cheerio.load(body);
    return $.text();
  } catch (e) {
    return body;
  }
}

class AIService {
  // Single AI call that returns both category and summary at once
  async processEmail(emailData, categories) {
    if (!process.env.GROQ_API_KEY) return { category: null, summary: "AI service unavailable" };

    const categoryList = categories.map(c => `${c.name}: ${c.description}`).join("\n");
    const body = stripHtml(emailData.body || "").substring(0, 1500);

    const prompt = `You are an email assistant. Given this email and list of categories, respond in exactly this format:
CATEGORY: <category name>
SUMMARY: <1-2 sentence summary of what the email is about>

Email Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${body}

Categories:
${categoryList}`;

    try {
      const text = await callGroq(prompt, 150);
      const categoryMatch = text.match(/CATEGORY:\s*(.+)/i);
      const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);

      const rawCategory = categoryMatch?.[1]?.trim() || "";
      const summary = summaryMatch?.[1]?.trim() || "Summary unavailable";

      const category = categories.find(c => c.name.toLowerCase() === rawCategory.toLowerCase())
        || categories.find(c => rawCategory.toLowerCase().includes(c.name.toLowerCase()))
        || categories.find(c => c.name.toLowerCase().includes(rawCategory.toLowerCase()))
        || null;

      return { category, summary };
    } catch (err) {
      console.error("processEmail error:", err.message);
      return { category: null, summary: "Summary unavailable" };
    }
  }

  // Keep these for backward compatibility
  async categorizeEmail(emailData, categories) {
    const { category } = await this.processEmail(emailData, categories);
    return category;
  }

  async summarizeEmail(emailData) {
    if (!process.env.GROQ_API_KEY) return "AI service unavailable";
    const body = stripHtml(emailData.body || "").substring(0, 1500);
    const prompt = `Summarize this email in 1-2 sentences. What is the main point or action needed?

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${body}`;
    try {
      return (await callGroq(prompt, 100)).trim();
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
            'a[href*="unsubscribe" i]', 'a[href*="opt-out" i]',
            'a[href*="remove" i]', 'a[href*="preferences" i]',
            'a:contains("unsubscribe")', 'a:contains("opt out")',
            'a:contains("remove me")', 'a:contains("manage preferences")',
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
      return null;
    }
  }

  async testConnection() {
    if (!process.env.GROQ_API_KEY) return { success: false, error: "No GROQ_API_KEY set" };
    try {
      const text = await callGroq("Say hello in one word", 10);
      return { success: true, response: text.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = new AIService();
