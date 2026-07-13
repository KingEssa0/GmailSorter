const { google } = require("googleapis");

class GmailService {
  constructor() {
    this.client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  getClient(account) {
    this.client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });
    return google.gmail({ version: "v1", auth: this.client });
  }

  async getNewEmails(account, maxResults = 10) {
    try {
      const gmail = this.getClient(account);

      const res = await gmail.users.messages.list({
        userId: "me",
        q: "in:inbox newer_than:7d",
        maxResults,
      });

      if (!res.data.messages) return [];

      const emails = [];
      for (const msg of res.data.messages) {
        const email = await this.getEmailDetails(gmail, msg.id);
        email.accountId = account._id;
        email.accountEmail = account.email;
        emails.push(email);
      }

      return emails;
    } catch (err) {
      if (err.code === 401 || err.message?.includes("invalid_grant")) {
        try {
          await this.refreshToken(account);
          return this.getNewEmails(account, maxResults);
        } catch (e) {
          throw new Error(`Auth failed for ${account.email} - please reconnect`);
        }
      }
      throw err;
    }
  }

  async getEmailDetails(gmail, messageId) {
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const msg = res.data;
    const headers = msg.payload.headers;

    const subject = headers.find(h => h.name === "Subject")?.value || "";
    const from = headers.find(h => h.name === "From")?.value || "";
    const date = headers.find(h => h.name === "Date")?.value || "";

    let body = "";
    if (msg.payload.body.data) {
      body = Buffer.from(msg.payload.body.data, "base64").toString();
    } else if (msg.payload.parts) {
      const part = msg.payload.parts.find(p => p.mimeType === "text/plain")
        || msg.payload.parts.find(p => p.mimeType === "text/html");
      if (part?.body.data) {
        body = Buffer.from(part.body.data, "base64").toString();
      }
    }

    return { id: messageId, subject, from, date, body: body.substring(0, 10000) };
  }

  async markAsProcessed(account, messageId) {
    const gmail = this.getClient(account);
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  }

  async archiveEmail(account, messageId) {
    const gmail = this.getClient(account);
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
  }

  async refreshToken(account) {
    this.client.setCredentials({ refresh_token: account.refreshToken });
    const { credentials } = await this.client.refreshAccessToken();

    const Account = require("../models/Account");
    await Account.findByIdAndUpdate(account._id, { accessToken: credentials.access_token });
    account.accessToken = credentials.access_token;

    return credentials.access_token;
  }

  async getUserProfile(account) {
    const gmail = this.getClient(account);
    const res = await gmail.users.getProfile({ userId: "me" });
    return {
      email: res.data.emailAddress,
      messagesTotal: res.data.messagesTotal,
      threadsTotal: res.data.threadsTotal,
    };
  }

  async getEmailsFromAllAccounts(userId, maxResults = 10) {
    const Account = require("../models/Account");
    const accounts = await Account.find({ userId, isActive: true });
    if (accounts.length === 0) return [];

    const all = [];
    for (const account of accounts) {
      try {
        const emails = await this.getNewEmails(account, maxResults);
        all.push(...emails);
      } catch (e) {
        console.error(`failed fetching for ${account.email}:`, e);
      }
    }

    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

module.exports = new GmailService();
