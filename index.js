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
const CUSTOM_MESSAGE = "https://cdn.discordapp.com/attachments/895376208085274675/1128908209445408848/image0.gif?ex=6988bbf3&is=69876a73&hm=98feb2f4eeb4660cb14bf91357311e284ec7b510e8917b41e2331a06aab6b1c5";

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



