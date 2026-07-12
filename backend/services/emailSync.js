const Account = require("../models/Account");
const Category = require("../models/Category");
const Email = require("../models/Email");
const gmailService = require("./gmail");
const aiService = require("./ai");

class EmailSyncService {
  constructor() {
    this.running = false;
  }

  async syncUserEmails(userId, accountId = null) {
    const categories = await Category.find({ userId });
    if (categories.length === 0) return { synced: 0, message: "No categories found" };

    let accounts;
    if (accountId) {
      const acc = await Account.findOne({ _id: accountId, userId });
      if (!acc) throw new Error("Account not found");
      accounts = [acc];
    } else {
      accounts = await Account.find({ userId });
    }

    if (accounts.length === 0) return { synced: 0, message: "No Gmail accounts connected" };

    let totalSynced = 0;
    let totalFetched = 0;

    for (const account of accounts) {
      try {
        const gmailEmails = await gmailService.getNewEmails(account, 50);
        if (gmailEmails.length === 0) continue;

        // filter out ones we already have
        const existingIds = new Set(
          (await Email.find({
            gmailId: { $in: gmailEmails.map(e => e.id) },
            userId,
            accountId: account._id,
          }).select("gmailId")).map(e => e.gmailId)
        );

        const toProcess = gmailEmails.filter(e => !existingIds.has(e.id));
        if (toProcess.length === 0) continue;

        const processed = [];
        const categoryUpdates = {};
        const BATCH = 5;

        for (let i = 0; i < toProcess.length; i += BATCH) {
          const batch = toProcess.slice(i, i + BATCH);
          const results = await Promise.all(batch.map(async (emailData) => {
            try {
              let category = await aiService.categorizeEmail(emailData, categories);
              if (!category) category = categories[0];

              categoryUpdates[category._id] = (categoryUpdates[category._id] || 0) + 1;

              let summary = "Summary unavailable";
              try { summary = await aiService.summarizeEmail(emailData); } catch (e) {}

              let unsubscribeLink = null;
              try { unsubscribeLink = aiService.extractUnsubscribeLink(emailData.body); } catch (e) {}

              return {
                userId,
                accountId: account._id,
                categoryId: category._id,
                gmailId: emailData.id,
                from: emailData.from,
                subject: emailData.subject,
                body: emailData.body,
                aiSummary: summary,
                unsubscribeLink,
                receivedDate: emailData.date ? new Date(emailData.date) : new Date(),
              };
            } catch (e) {
              console.error(`failed processing email ${emailData.id}:`, e);
              return null;
            }
          }));

          processed.push(...results.filter(Boolean));
        }

        if (processed.length > 0) {
          await Email.insertMany(processed);
          await Promise.all(
            Object.entries(categoryUpdates).map(([id, count]) =>
              Category.findByIdAndUpdate(id, { $inc: { emailCount: count } })
            )
          );
          totalSynced += processed.length;
        }

        await Account.findByIdAndUpdate(account._id, { lastSyncedAt: new Date() });
        totalFetched += gmailEmails.length;
      } catch (e) {
        console.error(`error syncing ${account.email}:`, e);
      }
    }

    return {
      synced: totalSynced,
      total: totalFetched,
      message: `Synced ${totalSynced} new emails across ${accounts.length} account(s)`,
    };
  }

  async syncAllUsers() {
    if (this.running) return;
    this.running = true;

    try {
      const accounts = await Account.find({
        accessToken: { $exists: true },
        refreshToken: { $exists: true },
      }).populate("userId", "email");

      // group by user
      const byUser = {};
      for (const acc of accounts) {
        const uid = acc.userId._id.toString();
        if (!byUser[uid]) byUser[uid] = { user: acc.userId, accounts: [] };
        byUser[uid].accounts.push(acc);
      }

      const results = [];
      for (const [userId, data] of Object.entries(byUser)) {
        try {
          const result = await this.syncUserEmails(userId);
          results.push({ userId, email: data.user.email, ...result });
        } catch (e) {
          results.push({ userId, email: data.user.email, synced: 0, error: e.message });
        }
      }

      return results;
    } finally {
      this.running = false;
    }
  }

  async archiveEmails(userId, emailIds) {
    const results = [];
    for (const id of emailIds) {
      try {
        const email = await Email.findOne({ _id: id, userId });
        if (!email) { results.push({ emailId: id, success: false, error: "not found" }); continue; }
        await Email.findByIdAndUpdate(id, { isArchived: true });
        results.push({ emailId: id, success: true });
      } catch (e) {
        results.push({ emailId: id, success: false, error: e.message });
      }
    }
    return results;
  }

  // fallback if redis/queue isnt available
  startAutoSync() {
    setTimeout(() => this.syncAllUsers(), 30000);
    setInterval(() => this.syncAllUsers(), 15 * 60 * 1000);
  }
}

module.exports = new EmailSyncService();
