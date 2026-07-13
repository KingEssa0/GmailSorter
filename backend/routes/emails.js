const express = require("express");
const Email = require("../models/Email");
const Category = require("../models/Category");
const Account = require("../models/Account");
const auth = require("../middleware/auth");
const gmailService = require("../services/gmail");
const aiService = require("../services/ai");
const unsubscribeService = require("../services/unsubscribe");

const router = express.Router();

router.get("/category/:categoryId", auth, async (req, res) => {
  try {
    const emails = await Email.find({ userId: req.user._id, categoryId: req.params.categoryId })
      .populate("accountId", "email")
      .sort({ createdAt: -1 });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/:emailId/content", auth, async (req, res) => {
  try {
    const email = await Email.findOne({ _id: req.params.emailId, userId: req.user._id });
    if (!email) return res.status(404).json({ msg: "Email not found" });

    res.json({
      content: email.body,
      subject: email.subject,
      from: email.from,
      receivedDate: email.receivedDate,
      aiSummary: email.aiSummary,
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/sync", auth, async (req, res) => {
  try {
    const { accountId } = req.body;

    const categories = await Category.find({ userId: req.user._id });
    if (categories.length === 0) {
      return res.status(400).json({ msg: "Create at least one category before syncing" });
    }

    let accountsToSync;
    if (accountId) {
      const account = await Account.findOne({ _id: accountId, userId: req.user._id });
      if (!account) return res.status(404).json({ msg: "Gmail account not found" });
      accountsToSync = [account];
    } else {
      accountsToSync = await Account.find({ userId: req.user._id });
    }

    if (accountsToSync.length === 0) {
      return res.status(400).json({ msg: "No Gmail accounts connected" });
    }

    let totalSynced = 0;
    let totalFetched = 0;
    const errors = [];

    for (const account of accountsToSync) {
      try {
        let newEmails = [];
        try {
          newEmails = await gmailService.getNewEmails(account, 10);
        } catch (gmailErr) {
          errors.push({
            account: account.email,
            error: gmailErr.message.includes("auth") || gmailErr.message.includes("token")
              ? "Authentication expired. Please reconnect this Gmail account."
              : `Failed to fetch emails: ${gmailErr.message}`,
          });
          continue;
        }

        if (newEmails.length === 0) continue;

        let synced = 0;
        for (const emailData of newEmails) {
          try {
            const already = await Email.findOne({
              gmailId: emailData.id,
              userId: req.user._id,
              accountId: account._id,
            });
            if (already) continue;

            let category;
            let summary = "Summary not available";
            try {
              const result = await aiService.processEmail(emailData, categories);
              category = result.category;
              summary = result.summary;
            } catch (e) {}
            if (!category) category = categories[0];

            let unsubscribeLink = null;
            try {
              unsubscribeLink = aiService.extractUnsubscribeLink(emailData.body || "");
            } catch (e) {}

            const email = new Email({
              userId: req.user._id,
              accountId: account._id,
              categoryId: category._id,
              gmailId: emailData.id,
              from: emailData.from || "Unknown sender",
              subject: emailData.subject || "No subject",
              body: emailData.body || "",
              aiSummary: summary,
              unsubscribeLink,
              receivedDate: emailData.date ? new Date(emailData.date) : new Date(),
            });

            await email.save();
            await Category.findByIdAndUpdate(category._id, { $inc: { emailCount: 1 } });
            synced++;
          } catch (e) {
            errors.push({ account: account.email, emailId: emailData.id, error: e.message });
          }
        }

        totalSynced += synced;
        totalFetched += newEmails.length;
      } catch (e) {
        errors.push({ account: account.email, error: e.message });
      }
    }

    const msg = totalFetched === 0
      ? "No new emails to sync"
      : `Synced ${totalSynced} of ${totalFetched} emails across ${accountsToSync.length} account(s)`;

    const response = { msg, synced: totalSynced, total: totalFetched, accounts: accountsToSync.length, errors: errors.length };
    if (errors.length > 0) response.errorDetails = errors;

    const hasAuthErrors = errors.some(e => e.error.includes("auth") || e.error.includes("token"));
    if (hasAuthErrors) {
      response.authenticationRequired = true;
      response.msg = msg + ". Some accounts need re-authentication.";
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ msg: "Sync failed", error: err.message });
  }
});

router.post("/unsubscribe", auth, async (req, res) => {
  try {
    const { emailIds } = req.body;
    if (!emailIds || emailIds.length === 0) return res.status(400).json({ msg: "No email IDs provided" });

    const emails = await Email.find({ _id: { $in: emailIds }, userId: req.user._id });
    if (emails.length === 0) return res.status(404).json({ msg: "No emails found" });

    const results = [];
    let successCount = 0;
    let alreadyDone = 0;
    let noLink = 0;
    let failed = 0;

    for (const email of emails) {
      if (!email.unsubscribeLink) {
        noLink++;
        results.push({ emailId: email._id, subject: email.subject, success: false, error: "No unsubscribe link", reason: "NO_UNSUBSCRIBE_LINK" });
        continue;
      }

      try {
        const result = await unsubscribeService.unsubscribe(email.unsubscribeLink);

        if (result.success) {
          if (result.wasAlreadyUnsubscribed || result.reason === "ALREADY_UNSUBSCRIBED") {
            alreadyDone++;
          } else {
            successCount++;
          }
          await Email.findByIdAndUpdate(email._id, {
            $set: { unsubscribeProcessed: true, unsubscribeDate: new Date() },
          });
        } else {
          failed++;
        }

        results.push({
          emailId: email._id,
          subject: email.subject,
          success: result.success,
          message: result.message,
          error: result.error,
          strategy: result.strategy,
          reason: result.reason,
          wasAlreadyUnsubscribed: result.wasAlreadyUnsubscribed,
        });
      } catch (e) {
        failed++;
        results.push({ emailId: email._id, subject: email.subject, success: false, error: e.message, reason: "TECHNICAL_ERROR" });
      }
    }

    res.json({
      msg: `Processed ${emails.length} emails. ${successCount} successful, ${alreadyDone} already unsubscribed, ${noLink} no link, ${failed} failed.`,
      total: emails.length,
      successful: successCount,
      failed,
      alreadyUnsubscribed: alreadyDone,
      noUnsubscribeLink: noLink,
      results,
    });
  } catch (err) {
    res.status(500).json({ msg: "Unsubscribe failed", error: err.message });
  }
});

router.delete("/bulk", auth, async (req, res) => {
  try {
    const { emailIds } = req.body;
    if (!emailIds || emailIds.length === 0) return res.status(400).json({ msg: "No email IDs provided" });

    const result = await Email.deleteMany({ _id: { $in: emailIds }, userId: req.user._id });
    res.json({ msg: `${result.deletedCount} emails deleted`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ msg: "Delete failed", error: err.message });
  }
});

router.get("/account/:accountId", auth, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.accountId, userId: req.user._id });
    if (!account) return res.status(404).json({ msg: "Account not found" });

    const emails = await Email.find({ userId: req.user._id, accountId: req.params.accountId })
      .populate("categoryId", "name")
      .sort({ receivedDate: -1 });

    res.json({ account: account.email, emails });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
