
import { Client, GatewayIntentBits, Partials } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// CONFIG
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID; // channel where users type announcements

// IMPORTANT: role mention format is <@&ROLE_ID>
const PING_TEXT = "<@&1469745384011075799>";

// Webhook config
const WEBHOOK_URL = process.env.WEBHOOK_URL; // the channel webhook URL
const WEBHOOK_NAME = process.env.WEBHOOK_NAME ?? "Announcement"; // shown name
const WEBHOOK_AVATAR_URL = process.env.WEBHOOK_AVATAR_URL; // optional avatar url

// Optional: prevent rapid re-triggers by same user (seconds)
const USER_COOLDOWN_SECONDS = Number(process.env.USER_COOLDOWN_SECONDS ?? "0");
const lastUserPostAt = new Map(); // userId -> timestamp ms

if (!process.env.DISCORD_TOKEN || !TARGET_CHANNEL_ID || !WEBHOOK_URL) {
  console.error(
    "Missing env vars: DISCORD_TOKEN, TARGET_CHANNEL_ID, and WEBHOOK_URL are required."
  );
  process.exit(1);
}

function stripMentions(raw) {
  if (!raw) return "";

  let text = raw;

  // Remove user mentions: <@123> and <@!123>
  text = text.replace(/<@!?(\d+)>/g, "");

  // Remove role mentions: <@&123>
  text = text.replace(/<@&(\d+)>/g, "");

  // Remove channel mentions: <#123>
  text = text.replace(/<#(\d+)>/g, "");

  // Remove @everyone / @here
  text = text.replace(/@everyone/gi, "");
  text = text.replace(/@here/gi, "");

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

// ---- NEW: alternate webhook "username" to force Discord to show header each time ----
let flip = false;
function webhookName() {
  flip = !flip;
  // Looks the same as "Announcement", but Discord treats it as a different author block.
  return flip ? WEBHOOK_NAME : `${WEBHOOK_NAME}\u200b`;
}

async function sendViaWebhook(content) {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      username: webhookName(),
      avatar_url: WEBHOOK_AVATAR_URL
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Webhook failed: ${res.status} ${res.statusText} ${txt}`);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    // Ignore bots + ignore webhook messages (prevents loops)
    if (message.author.bot) return;
    if (message.webhookId) return;

    // Only react in the target channel
    if (message.channel.id !== TARGET_CHANNEL_ID) return;

    // Optional per-user cooldown
    if (USER_COOLDOWN_SECONDS > 0) {
      const now = Date.now();
      const last = lastUserPostAt.get(message.author.id) ?? 0;
      if (now - last < USER_COOLDOWN_SECONDS * 1000) {
        await message.delete().catch(() => {});
        return;
      }
      lastUserPostAt.set(message.author.id, now);
    }

    const cleaned = stripMentions(message.content);

    // Delete the original message
    await message.delete().catch(() => {});

    // Build repost content (clean, like Hella)
    const boldText = cleaned ? ` **${cleaned}**` : "";
    const out = `${PING_TEXT}${boldText}`;

    await sendViaWebhook(out);
  } catch (err) {
    console.error("Error handling messageCreate:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);








