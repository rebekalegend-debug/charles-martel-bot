/**
 * Charles Martel — Rise of Kingdoms "VIP support" bot (ONE FILE)
 * - Replies to normal messages (no slash, no mention)
 * - Only in one help channel (prevents spam)
 * - Uses OpenAI Responses API for answers
 *
 * Env vars (Railway Variables or local .env):
 *   DISCORD_TOKEN=...
 *   OPENAI_API_KEY=...
 *
 * Discord Dev Portal -> Bot -> enable "MESSAGE CONTENT INTENT"
 */

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import OpenAI from "openai";

// ====== CONFIG ======
const HELP_CHANNEL_ID = "1469851657520283648"; // your channel
const COOLDOWN_MS = 8000; // per-user cooldown
const MAX_INPUT_CHARS = 1200; // keep prompts tight
const MODEL = "gpt-5-mini"; // good cost/quality default (change anytime)

// ====== Minimal built-in RoK knowledge snippets (expand this!) ======
// These are short, general, and safe. Add your own curated notes + links.
const ROK_KB = [
  {
    tags: ["beginner", "start", "tips", "early", "progression"],
    text:
      "Early game priorities: keep building & research running 24/7, push VIP with free chests/events, focus one main troop type, and avoid over-investing universal sculptures into low-value epics once you unlock strong legendaries. Keep hospitals upgraded and avoid dead troops unless needed.",
  },
  {
    tags: ["infantry", "open field", "pairing", "f2p"],
    text:
      "Infantry open-field basics: bring tanky march + sustain. Early/mid: Bjorn+Sun Tzu is a strong epic combo for AoE. Later: mix a primary that provides mitigation/sustain with a secondary that adds AoE/utility. Match your gear and troop type to the march.",
  },
  {
    tags: ["cavalry", "pairing", "barb", "farm", "peacekeeping"],
    text:
      "Cavalry PvE/barb chain: prioritize Peacekeeping talents, AP efficiency, and march speed. Use commanders with barb damage/bonus AP refunds if available. For chain farming, AoE skills help hit multiple barbs.",
  },
  {
    tags: ["kvk", "role", "rally", "garrison"],
    text:
      "KvK roles: if you're not a rally/garrison lead with maxed meta commanders + top gear, play open field/support: join rallies, bring debuffs/utility, keep troops alive, and focus on efficiency (kills per heal).",
  },
];

// ====== Basic retrieval: score by tag keyword overlap ======
function retrieveKB(query) {
  const q = query.toLowerCase();
  const tokens = new Set(q.split(/[^a-z0-9]+/g).filter(Boolean));
  const scored = ROK_KB.map((item) => {
    let score = 0;
    for (const t of item.tags) if (tokens.has(t)) score += 2;
    // small bonus if query contains any tag as substring
    for (const t of item.tags) if (q.includes(t)) score += 1;
    return { item, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .filter((x) => x.score > 0)
    .map((x) => x.item.text);

  return scored;
}

// ====== OpenAI client ======
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in env.");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ====== Discord client ======
if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN in env.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // required for normal messages
  ],
});

const cooldown = new Map(); // userId -> last timestamp

client.once("ready", () => {
  console.log(`✅ Charles Martel online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return; // ignore DMs
    if (message.channel.id !== HELP_CHANNEL_ID) return;

    const textRaw = (message.content || "").trim();
    if (textRaw.length < 3) return;

    // cooldown per user
    const now = Date.now();
    const last = cooldown.get(message.author.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    cooldown.set(message.author.id, now);

    // trim input
    const text = textRaw.slice(0, MAX_INPUT_CHARS);

    // retrieve small KB context
    const kb = retrieveKB(text);
    const kbBlock =
      kb.length > 0
        ? `Known notes (curated snippets):\n- ${kb.join("\n- ")}`
        : "Known notes: (none matched)";

    // VIP-support style instructions
    const prompt = `
You are "Charles Martel", a Rise of Kingdoms helper inside Discord.
Be concise but high-signal (like VIP support): give direct recommendations, then ask 1–3 targeted follow-up questions if needed.
Rules:
- Do NOT invent patch notes or “latest meta” claims. If something depends on patches, say so.
- If user question lacks context, ask for: game stage (early/mid/late), spender tier (F2P/low/mid/high), mode (open field/rally/garrison/canyon/barbs/KvK), troop focus, commanders owned.
- Prefer practical checklists and “do / don’t”.
- If you’re unsure, say what info is missing and give safe general guidance.

User message:
${text}

${kbBlock}
`.trim();

    // Discord typing indicator
    await message.channel.sendTyping();

    // Call OpenAI Responses API
    // Docs: Responses API is recommended for new projects. 
    const resp = await openai.responses.create({
      model: MODEL,
      input: prompt,
    });

    // Extract text output robustly
    const out =
      (resp.output_text && resp.output_text.trim()) ||
      "I couldn’t generate a response. Try rephrasing your question.";

    // Keep Discord replies under common limits (safe cutoff)
    const safe = out.length > 1800 ? out.slice(0, 1800) + "…" : out;

    await message.reply(safe);
  } catch (err) {
    console.error("Bot error:", err);
    // best-effort user-facing message
    try {
      await message.reply("⚠️ Something broke on my side. Try again in a moment.");
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
