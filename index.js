


/**
 * Charles Martel — Rise of Kingdoms "VIP support" bot (ONE FILE)
 * - Replies to normal messages (no slash, no mention)
 * - Only in one help channel
 * - Uses OpenAI for answers
 * - Railway-friendly (binds to PORT)
 *
 * Railway Variables (required):
 *   DISCORD_TOKEN=...
 *   OPENAI_API_KEY=...
 *
 * Discord Dev Portal -> Bot -> enable "MESSAGE CONTENT INTENT"
 */

import "dotenv/config";
import http from "node:http";
import { Client, GatewayIntentBits } from "discord.js";
import OpenAI from "openai";

// ====== CONFIG ======
const HELP_CHANNEL_ID = "1469851657520283648";
const COOLDOWN_MS = 8000;
const MAX_INPUT_CHARS = 1200;
const MODEL = "gpt-4o-mini"; // more widely available

// ====== Minimal built-in RoK knowledge snippets ======
const ROK_KB = [
  {
    tags: ["beginner", "start", "tips", "early", "progression"],
    text:
      "Early game priorities: keep building & research running 24/7, push VIP via free chests/events, pick ONE main troop type to focus, and avoid dumping universals into low-value commanders once you have better options. Keep hospitals upgraded; avoid dead troops unless necessary.",
  },
  {
    tags: ["infantry", "open", "field", "pairing", "f2p"],
    text:
      "Infantry open-field basics: durability + sustain + good trades. Early/mid: Bjorn + Sun Tzu is a strong epic combo for AoE. Later: pair a tanky primary (mitigation/sustain) with a secondary that adds AoE/utility. Match gear and troop type to the march.",
  },
  {
    tags: ["cavalry", "pairing", "barb", "farm", "peacekeeping"],
    text:
      "PvE/barb chain: Peacekeeping talents, AP efficiency, march speed. Use commanders with PvE damage bonuses. AoE skills help for chaining multiple barbs.",
  },
  {
    tags: ["kvk", "role", "rally", "garrison"],
    text:
      "KvK roles: if you’re not a rally/garrison lead with maxed meta commanders + strong gear, play open-field/support: join rallies, bring debuffs/utility, trade efficiently (kills per heal), and avoid unnecessary hospital pressure.",
  },
];

// ====== Simple retrieval by keyword overlap ======
function retrieveKB(query) {
  const q = query.toLowerCase();
  const tokens = new Set(q.split(/[^a-z0-9]+/g).filter(Boolean));

  return ROK_KB.map((item) => {
    let score = 0;
    for (const t of item.tags) {
      if (tokens.has(t)) score += 2;
      if (q.includes(t)) score += 1;
    }
    return { item, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .filter((x) => x.score > 0)
    .map((x) => x.item.text);
}

// ====== Required env vars ======
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in Railway Variables.");
  process.exit(1);
}
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN in Railway Variables.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ====== Railway health server (keeps container alive) ======
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Charles Martel is online.\n");
  })
  .listen(PORT, () => console.log(`🌐 Health server listening on :${PORT}`));

// ====== Discord client ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const cooldown = new Map(); // userId -> last timestamp

client.once("ready", () => {
  console.log(`✅ Charles Martel online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channel.id !== HELP_CHANNEL_ID) return;

    const textRaw = (message.content || "").trim();
    if (textRaw.length < 3) return;

    // cooldown per user
    const now = Date.now();
    const last = cooldown.get(message.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    cooldown.set(message.author.id, now);

    const text = textRaw.slice(0, MAX_INPUT_CHARS);

    const kb = retrieveKB(text);
    const kbBlock =
      kb.length > 0
        ? `Known notes (curated snippets):\n- ${kb.join("\n- ")}`
        : "Known notes: (none matched)";

    const prompt = `
You are "Charles Martel", a Rise of Kingdoms helper inside Discord.
Be concise but high-signal (VIP support style): give direct recommendations, then ask 1–3 targeted follow-up questions if needed.

Rules:
- Do NOT invent patch notes or "latest meta". If it depends on patches, say so.
- If missing context, ask for: stage (early/mid/late), spender tier (F2P/low/mid/high), mode (open field/rally/garrison/canyon/barbs/KvK), troop focus, commanders owned.
- Prefer checklists and do/don't guidance.

User message:
${text}

${kbBlock}
`.trim();

    await message.channel.sendTyping();

    const resp = await openai.responses.create({
      model: MODEL,
      input: prompt,
    });

    const out =
      (resp.output_text && resp.output_text.trim()) ||
      "I couldn’t generate a response. Try rephrasing your question.";

    const safe = out.length > 1800 ? out.slice(0, 1800) + "…" : out;
    await message.reply(safe);
  } catch (err) {
    // This prints the real cause in Railway logs
    console.error("Bot error FULL:", err);
    if (err?.status) console.error("Status:", err.status);
    if (err?.message) console.error("Message:", err.message);

    try {
      await message.reply(
        "⚠️ I hit an error talking to the AI. Check Railway logs for details (key/billing/model/rate limit)."
      );
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
