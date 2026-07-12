const Queue = require("bull");
const emailSyncService = require("./emailSync");

let emailQueue = null;

function getQueue() {
  if (emailQueue) return emailQueue;

  const redisConfig = process.env.REDIS_URL || {
    redis: {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || "127.0.0.1",
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    },
  };

  emailQueue = new Queue("email-sync", redisConfig);

  emailQueue.process(async (job) => {
    console.log(`processing sync job ${job.id}`);
    return await emailSyncService.syncAllUsers();
  });

  emailQueue.on("completed", (job) => console.log(`job ${job.id} done`));
  emailQueue.on("failed", (job, err) => console.error(`job ${job.id} failed:`, err.message));

  return emailQueue;
}

const scheduleAutoSync = async () => {
  const queue = getQueue();

  // helper to timeout redis calls - if redis is slow/down we dont want to hang
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Redis timed out")), ms)),
  ]);

  const existing = await withTimeout(queue.getRepeatableJobs(), 4000);
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await withTimeout(
    queue.add({}, { repeat: { every: 15 * 60 * 1000 }, removeOnComplete: true, removeOnFail: true }),
    4000
  );

  console.log("auto-sync scheduled every 15 min");
};

module.exports = {
  get emailQueue() { return emailQueue; },
  scheduleAutoSync,
};
