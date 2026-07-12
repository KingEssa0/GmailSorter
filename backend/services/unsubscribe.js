class UnsubscribeService {
  async unsubscribe(url) {
    if (!url) return { success: false, error: "No unsubscribe link", reason: "NO_UNSUBSCRIBE_LINK" };
    if (!this.isValidUrl(url)) return { success: false, error: "Invalid URL", reason: "INVALID_URL" };

    const isProd = process.env.NODE_ENV === "production";
    const puppeteer = isProd ? require("puppeteer-core") : require("puppeteer");
    const executablePath = isProd
      ? "/opt/render/.cache/puppeteer/chrome/linux-138.0.7204.168/chrome-linux64/chrome"
      : puppeteer.executablePath();

    let browser;
    try {
      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
        executablePath,
      });

      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
      await page.setViewport({ width: 1366, height: 768 });

      // hide webdriver to avoid bot detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await this.wait(page, 3000);

      const alreadyDone = await this.checkAlreadyUnsubscribed(page);
      if (alreadyDone.isAlreadyUnsubscribed) {
        return { success: true, message: alreadyDone.message, reason: "ALREADY_UNSUBSCRIBED", wasAlreadyUnsubscribed: true };
      }

      // try each strategy until one works
      const strategies = [
        () => this.clickUnsubscribeButton(page),
        () => this.submitEmailForm(page),
        () => this.handleCheckboxes(page),
        () => this.handleConfirmation(page),
        () => this.handleDropdown(page),
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          const result = await strategies[i]();
          if (result.success) {
            await this.wait(page, 3000);
            const verified = await this.verifySuccess(page);
            return {
              success: verified.success,
              message: verified.message || result.message,
              strategy: i + 1,
              reason: verified.success ? "UNSUBSCRIBED" : "UNKNOWN",
            };
          }
        } catch (e) {}
      }

      return { success: false, error: "No unsubscribe method worked", reason: "NO_UNSUBSCRIBE_METHOD_FOUND" };
    } catch (err) {
      return { success: false, error: err.message, reason: "TECHNICAL_ERROR" };
    } finally {
      if (browser) await browser.close();
    }
  }

  async checkAlreadyUnsubscribed(page) {
    try {
      const content = (await page.content()).toLowerCase();
      const url = page.url().toLowerCase();

      const indicators = [
        "already unsubscribed",
        "you are already unsubscribed",
        "you have already been unsubscribed",
        "already opted out",
        "not subscribed to this list",
        "subscription not found",
        "email not found in our list",
      ];

      const found = indicators.find(i => content.includes(i));
      if (found) return { isAlreadyUnsubscribed: true, message: `Already unsubscribed (${found})` };

      if (url.includes("already") && (url.includes("unsubscribed") || url.includes("removed"))) {
        return { isAlreadyUnsubscribed: true, message: "Already unsubscribed (URL)" };
      }

      return { isAlreadyUnsubscribed: false };
    } catch (e) {
      return { isAlreadyUnsubscribed: false };
    }
  }

  async wait(page, ms) {
    try {
      if (typeof page.waitForDelay === "function") await page.waitForDelay(ms);
      else if (typeof page.waitForTimeout === "function") await page.waitForTimeout(ms);
      else await new Promise(r => setTimeout(r, ms));
    } catch (e) {
      await new Promise(r => setTimeout(r, ms));
    }
  }

  isValidUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  async clickUnsubscribeButton(page) {
    const selectors = [
      'button[class*="unsubscribe" i]',
      'a[href*="unsubscribe" i]',
      'input[type="submit"][value*="unsubscribe" i]',
      'button[id*="unsubscribe" i]',
    ];

    for (const sel of selectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          const visible = await page.evaluate(e => {
            const s = window.getComputedStyle(e);
            return s.display !== "none" && s.visibility !== "hidden" && e.offsetParent !== null;
          }, el);
          if (visible) {
            const text = await page.evaluate(e => e.textContent?.toLowerCase() || "", el);
            await el.click();
            await this.wait(page, 2000);
            return { success: true, message: `clicked: ${text}` };
          }
        }
      } catch (e) { continue; }
    }

    // fallback - scan all buttons for unsubscribe text
    try {
      const buttons = await page.$$('button, a, input[type="submit"]');
      for (const btn of buttons) {
        const text = await page.evaluate(e => e.textContent?.toLowerCase() || "", btn);
        const visible = await page.evaluate(e => {
          const s = window.getComputedStyle(e);
          return s.display !== "none" && s.visibility !== "hidden" && e.offsetParent !== null;
        }, btn);

        if (visible && (text.includes("unsubscribe") || text.includes("opt out") || text.includes("remove me"))) {
          await btn.click();
          await this.wait(page, 2000);
          return { success: true, message: `clicked: ${text}` };
        }
      }
    } catch (e) {}

    return { success: false };
  }

  async submitEmailForm(page) {
    const inputs = await page.$$('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
    if (inputs.length === 0) return { success: false };

    try {
      await inputs[0].click({ clickCount: 3 });
      await inputs[0].type("user@example.com", { delay: 100 });
      await this.wait(page, 1000);

      let submitBtn = null;
      const submitSels = ['button[type="submit"]', 'input[type="submit"]'];

      for (const sel of submitSels) {
        const btns = await page.$$(sel);
        for (const btn of btns) {
          const visible = await page.evaluate(e => {
            const s = window.getComputedStyle(e);
            const r = e.getBoundingClientRect();
            return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
          }, btn);
          if (visible) { submitBtn = btn; break; }
        }
        if (submitBtn) break;
      }

      if (!submitBtn) {
        const allBtns = await page.$$("button");
        const keywords = ["submit", "unsubscribe", "confirm", "save", "update", "continue"];
        for (const btn of allBtns) {
          const text = await page.evaluate(e => e.textContent?.toLowerCase() || "", btn);
          const visible = await page.evaluate(e => {
            const s = window.getComputedStyle(e);
            return s.display !== "none" && s.visibility !== "hidden";
          }, btn);
          if (visible && keywords.some(k => text.includes(k))) { submitBtn = btn; break; }
        }
      }

      if (submitBtn) {
        await submitBtn.click();
        await this.wait(page, 3000);
        return { success: true, message: "submitted email form" };
      }

      // last resort
      await inputs[0].press("Enter");
      await this.wait(page, 2000);
      return { success: true, message: "submitted via enter key" };
    } catch (e) {
      return { success: false };
    }
  }

  async handleCheckboxes(page) {
    const checkboxes = await page.$$('input[type="checkbox"]');
    let changed = false;

    for (const cb of checkboxes) {
      try {
        const label = await page.evaluate(el => {
          const id = el.id;
          const lbl = id ? document.querySelector(`label[for="${id}"]`) : el.closest("label");
          return lbl ? lbl.textContent.toLowerCase() : "";
        }, cb);

        const checked = await page.evaluate(el => el.checked, cb);

        if ((label.includes("email") || label.includes("newsletter")) && checked) {
          await cb.click();
          changed = true;
        } else if ((label.includes("unsubscribe") || label.includes("opt out")) && !checked) {
          await cb.click();
          changed = true;
        }
      } catch (e) { continue; }
    }

    if (!changed) return { success: false };

    const submitSels = ['button[type="submit"]', 'input[type="submit"]'];
    for (const sel of submitSels) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await this.wait(page, 2000);
        return { success: true, message: "updated checkbox preferences" };
      }
    }

    return { success: false };
  }

  async handleConfirmation(page) {
    page.on("dialog", async d => await d.accept());

    const btns = await page.$$('button, a, input[type="submit"]');
    for (const btn of btns) {
      try {
        const text = await page.evaluate(e => e.textContent?.toLowerCase() || "", btn);
        const visible = await page.evaluate(e => {
          const s = window.getComputedStyle(e);
          return s.display !== "none" && s.visibility !== "hidden";
        }, btn);

        if (visible && (text.includes("confirm") || text.includes("yes") || text.includes("proceed"))) {
          await btn.click();
          await this.wait(page, 2000);
          return { success: true, message: `clicked confirm: ${text}` };
        }
      } catch (e) { continue; }
    }

    return { success: false };
  }

  async handleDropdown(page) {
    try {
      const selects = await page.$$("select");

      for (const select of selects) {
        const options = await page.$$eval("select option", opts =>
          opts.map(o => ({ value: o.value, text: o.textContent.toLowerCase() }))
        );

        const match = options.find(o =>
          o.text.includes("unsubscribe") || o.text.includes("opt out") || o.text.includes("no emails")
        );

        if (match) {
          await page.select("select", match.value);
          const btn = await page.$('button[type="submit"], input[type="submit"]');
          if (btn) {
            await btn.click();
            await this.wait(page, 2000);
            return { success: true, message: `selected dropdown: ${match.text}` };
          }
        }
      }

      return { success: false };
    } catch (e) {
      return { success: false };
    }
  }

  async verifySuccess(page) {
    try {
      await this.wait(page, 5000);

      const content = (await page.content()).toLowerCase();
      const url = page.url().toLowerCase();
      const title = (await page.title()).toLowerCase();

      const successPhrases = [
        "successfully unsubscribed",
        "you have been unsubscribed",
        "removed from list",
        "no longer receive",
        "preferences updated",
        "subscription cancelled",
        "opted out successfully",
        "thank you",
        "changes have been saved",
      ];

      const found = successPhrases.find(p => content.includes(p) || title.includes(p));
      if (found) return { success: true, message: `confirmed: "${found}"` };

      const urlSuccess = ["success", "unsubscribed", "complete", "confirmation", "updated"].find(s => url.includes(s));
      if (urlSuccess) return { success: true, message: `URL confirmed: ${urlSuccess}` };

      try {
        const el = await page.$(".success, .alert-success, .confirmation");
        if (el) return { success: true, message: "success element found" };
      } catch (e) {}

      return { success: false, message: "no success indicators found" };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

module.exports = new UnsubscribeService();
