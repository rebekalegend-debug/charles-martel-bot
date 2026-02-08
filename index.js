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
const PING_TEXT = "@everyone";
const GIF_URL =
  "https://cdn.discordapp.com/attachments/895376208085274675/1128908209445408848/image0.gif?ex=6988bbf3&is=69876a73&hm=98feb2f4eeb4660cb14bf91357311e284ec7b510e8917b41e2331a06aab6b1c5";

// Optional: prevent rapid re-triggers by same user (seconds)
const USER_COOLDOWN_SECONDS = Number(process.env.USER_COOLDOWN_SECONDS ?? "0");
const lastUserPostAt = new Map(); // userId -> timestamp ms

if (!process.env.DISCORD_TOKEN || !TARGET_CHANNEL_ID) {
  console.error("Missing env vars: DISCORD_TOKEN and TARGET_CHANNEL_ID are required.");
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

  // Remove @everyone / @here (including attempts to bypass with spaces)
  text = text.replace(/@everyone/gi, "");
  text = text.replace(/@here/gi, "");

  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.channel.id !== TARGET_CHANNEL_ID) return;

    const cleaned = stripMentions(message.content);

    // Delete the original message
    await message.delete().catch(() => {});

    // Bold + spacer (no gif, no embed)
    const boldText = cleaned ? `**${cleaned}**` : "** **";

    await message.channel.send(`${PING_TEXT} ${boldText}\n\u200b`);
  } catch (err) {
    console.error("Error handling messageCreate:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);







