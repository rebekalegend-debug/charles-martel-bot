import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TARGET_CHANNEL_ID = "1469759313202512176";
const PING_TEXT = "@everyone";
const CUSTOM_MESSAGE = "⚠️ Please read the announcement above.";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  // Ignore bots (including itself)
  if (message.author.bot) return;

  // Only react in one specific channel
  if (message.channel.id !== TARGET_CHANNEL_ID) return;

  // Detect ANY message (even empty or space)
  // Discord always sends at least 1 character, so no extra checks needed

  await message.channel.send(
    `${PING_TEXT}\n${CUSTOM_MESSAGE}`
  );
});

client.login(process.env.DISCORD_TOKEN);


