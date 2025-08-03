const { Telegraf, session } = require("telegraf");
const fs = require("fs");
require("dotenv").config();

const bot = new Telegraf(process.env.TOKEN);
bot.use(session({ defaultSession: () => ({}) }));

const ADMIN_ID = 6097947786; // Replace with your Telegram ID
const CHANNEL_ID = "-1002403291426"; // Bot must be admin in this channel
const DB_PATH = "./movies.json";

// Load or initialize DB
let database = { movies: {} };
if (fs.existsSync(DB_PATH)) {
  try {
    database = JSON.parse(fs.readFileSync(DB_PATH));
    if (!database.movies) database.movies = {};
  } catch {
    database = { movies: {} };
  }
}

function saveDB() {
  fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2));
}

function generateNumericID() {
  let uid;
  do {
    uid = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit ID
  } while (database.movies[uid]);
  return uid;
}

// ──────── /addmovie ────────
bot.command("addmovie", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.session.state = "awaiting_title";
  ctx.reply("🎬 Enter the movie or series title:");
});

// ──────── /addparts <id> ────────
bot.command("addparts", (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const uid = args[1];

  if (!uid || !database.movies[uid]) {
    return ctx.reply("❌ Invalid ID. Make sure the movie exists.");
  }

  ctx.session.state = "adding_parts";
  ctx.session.edit_uid = uid;
  ctx.session.new_parts = [];
  ctx.reply(
    `🎞 Upload new parts for movie: *${database.movies[uid].title}* (ID: ${uid})`,
    {
      parse_mode: "Markdown",
    },
  );
});

// ──────── /deletemovie <id> ────────
bot.command("deletemovie", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const args = ctx.message.text.split(" ");
  const uid = args[1];

  if (!uid) {
    return ctx.reply("❗ Usage: /deletemovie <movie_id>");
  }

  const movie = database.movies[uid];
  if (!movie) {
    return ctx.reply("❌ Movie not found with that ID.");
  }

  // Delete messages from channel
  if (movie.messages && Array.isArray(movie.messages)) {
    for (let msgId of movie.messages) {
      try {
        await ctx.telegram.deleteMessage(CHANNEL_ID, msgId);
      } catch (err) {
        console.warn(`⚠️ Failed to delete message ${msgId}:`, err.message);
      }
    }
  }

  const title = movie.title;
  delete database.movies[uid];
  saveDB();

  ctx.reply(
    `🗑️ Movie *${title}* (ID: ${uid}) has been deleted from database and channel.`,
    {
      parse_mode: "Markdown",
    },
  );
});

// ──────── TEXT HANDLER ────────
bot.on("text", async (ctx) => {
  const state = ctx.session?.state;

  if (state === "awaiting_title") {
    ctx.session.movie = { title: ctx.message.text };
    ctx.session.state = "awaiting_description";
    ctx.reply("📝 Enter the description of the movie:");
  } else if (state === "awaiting_description") {
    ctx.session.movie.description = ctx.message.text;
    ctx.session.state = "awaiting_count";
    ctx.reply("🔢 How many parts does this movie/series have?");
  } else if (state === "awaiting_count") {
    const count = parseInt(ctx.message.text);
    if (isNaN(count) || count <= 0) {
      return ctx.reply("❌ Please enter a valid number.");
    }

    ctx.session.movie.count = count;
    ctx.session.movie.parts = [];
    ctx.session.state = "awaiting_uploads";
    ctx.reply(
      `📤 Send the ${count} parts (videos) one by one with their captions.`,
    );
  } else {
    // User is searching movie by ID
    const uid = ctx.message.text.trim();
    const movie = database.movies[uid];
    if (!movie) {
      return ctx.reply("❌ Movie not found with that ID.");
    }

    movie.downloads = (movie.downloads || 0) + 1;
    saveDB();

    const created = new Date(movie.created_at).toLocaleString("en-GB");
    await ctx.reply(
      `🎬 *${movie.title}*\n` +
        `📝 ${movie.description}\n` +
        `📅 Created: ${created}\n` +
        `⬇️ Downloads: ${movie.downloads}`,
      { parse_mode: "Markdown" },
    );

    for (let part of movie.parts) {
      await ctx.replyWithVideo(part.file_id, {
        caption: part.caption || "",
      });
    }
  }
});

// ──────── VIDEO HANDLER ────────
bot.on("video", async (ctx) => {
  const state = ctx.session?.state;
  const video = ctx.message.video;
  const caption = ctx.message.caption || "";
  const file_id = video.file_id;

  // 🟢 Uploading new movie
  if (state === "awaiting_uploads") {
    ctx.session.movie.parts.push({ file_id, caption });

    const uploaded = ctx.session.movie.parts.length;
    const total = ctx.session.movie.count;

    ctx.reply(`✅ Received part ${uploaded}/${total}`);

    if (uploaded === total) {
      const uid = generateNumericID();
      let messageIds = [];

      // Save to channel and collect message IDs
      await ctx.telegram.sendMessage(
        CHANNEL_ID,
        `🎬 ${ctx.session.movie.title}\n📝 ${ctx.session.movie.description}`,
      );
      for (let part of ctx.session.movie.parts) {
        const sent = await ctx.telegram.sendVideo(CHANNEL_ID, part.file_id, {
          caption: part.caption || "",
        });
        messageIds.push(sent.message_id);
      }

      database.movies[uid] = {
        title: ctx.session.movie.title,
        description: ctx.session.movie.description,
        parts: ctx.session.movie.parts,
        posted_by: ctx.from.id,
        created_at: new Date().toISOString(),
        downloads: 0,
        messages: messageIds,
      };

      saveDB();

      ctx.reply(`✅ Movie uploaded!\n🆔 ID: \`${uid}\``, {
        parse_mode: "Markdown",
      });

      ctx.session = null;
    }
    return;
  }

  // 🟡 Adding parts to existing movie
  if (state === "adding_parts" && ctx.session.edit_uid) {
    const uid = ctx.session.edit_uid;
    const movie = database.movies[uid];
    if (!movie) return ctx.reply("❌ Movie not found.");

    // Save to channel and store message_id
    const sent = await ctx.telegram.sendVideo(CHANNEL_ID, file_id, {
      caption: caption || "",
    });

    movie.parts.push({ file_id, caption });
    if (!movie.messages) movie.messages = [];
    movie.messages.push(sent.message_id);
    saveDB();

    ctx.reply(`✅ Part added to *${movie.title}* (ID: ${uid})`, {
      parse_mode: "Markdown",
    });
  }
});

// ──────── BOT START ────────
bot.launch(() => {
  console.log("🎬 Bot is running...");
});
