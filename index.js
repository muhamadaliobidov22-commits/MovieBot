const { Telegraf, session, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const https = require("https");
const TOKEN = process.env.TOKEN;
const bot = new Telegraf(TOKEN);
const OWNER = parseInt(process.env.OWNER);
const CHANNEL = process.env.CHANNEL
bot.use(session());

// Define the exact path to the existing photo to be replaced
const existingPhotoPath = path.join(
  __dirname,
  "data",
  "image",
  "start_photo.png",
);
const usersIDDataPath = "./data/usersIDData.db";
const usersIDData = loadData(usersIDDataPath) || [];
const usersDataPath = "./data/usersData.db";
const usersData = loadData(usersDataPath) || [];
const adminsPath = "./data/admins.db";
const admins = loadData(adminsPath) || {
  admins: [],
  super_admins: [],
};
let premium_group_to_buy = null;
const statisticsPath = "./data/statistics.db";
const statistics = loadData(statisticsPath) || {
  totalUsers: [],
  Active: null,
  Inactive: null,
  premium_users: null,
  lastUpdate: null,
};
const languagesPath = {
  arabic: "./data/lang/Arabic.json",
  english: "./data/lang/English.json",
  russian: "./data/lang/Russian.json",
  uzbek: "./data/lang/Uzbek.json",
};
let isAdminAllow = true;
const languages = {
  ar: loadData(languagesPath.arabic),
  en: loadData(languagesPath.english),
  ru: loadData(languagesPath.russian),
  uz: loadData(languagesPath.uzbek),
};

const channelsPath = "./data/channels.db";
const channels = loadData(channelsPath) || {
  public: [],
  private: {},
  zayafka: {},
  public_zayafka: {},
};
const groupsPath = "./data/groups.db";
const groups = loadData(groupsPath) || {
  public: [],
  private: {},
  zayafka: {},
  public_zayafka: {},
};
const MoviesChannelPath = "./data/movieschannel.db";
const MoviesChannel = loadData(MoviesChannelPath) || {
  premiumChannel: null,
  freeChannel: null,
};
const MoviesPath = "./data/movies.db";
let Movies = loadData(MoviesPath) || {
  free_movie: {},
  premium_movie: {},
};
const MoviesLastIDpath = "./data/movieslastid.db";
let MoviesLastID = loadData(MoviesLastIDpath) || {
  PremiumID: 1,
  FreeID: 1
}
const joinRequestsPath = "./data/joinRequests.db";
const joinRequests = loadData(joinRequestsPath) || {};

const formatLink = (username) => `https://t.me/${username.replace("@", "")}`;
async function isFollowed(ctx) {
  const links = [];
  const userID = ctx.from.id;
  try {
    for (const channel of channels.public) {
      const member = await bot.telegram.getChatMember(channel, userID);
      if (
        member.status !== "member" &&
        member.status !== "administrator" &&
        member.status !== "creator"
      ) {
        links.push(await formatLink(channel));
      }
    }
    for (const [chatID, link] of Object.entries(channels.private)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    for (const [chatID, link] of Object.entries(channels.zayafka)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    for (const [chatID, link] of Object.entries(channels.public_zayafka)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    for (const group of groups.public) {
      const member = await bot.telegram.getChatMember(group, userID);
      if (
        member.status !== "member" &&
        member.status !== "administrator" &&
        member.status !== "creator"
      ) {
        links.push(await formatLink(group));
      }
    }
    for (const [chatID, link] of Object.entries(groups.private)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    for (const [chatID, link] of Object.entries(groups.zayafka)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    for (const [chatID, link] of Object.entries(groups.public_zayafka)) {
      const joinedUsers = joinRequests[chatID] || [];
      if (!joinedUsers.includes(userID)) {
        links.push(link);
      }
    }
    return links;
  } catch (error) {
    console.log(error);
    return false;
  }
}
let isFirstTime = {};
function loadData(path) {
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path));
  } else {
    return null;
  }
}
function saveData(path, data) {
  if (data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  } else {
    return "data_empty";
  }
}
function findsomething(data, object, value) {
  if (data.length === 0) {
    return null;
  } else {
    if (data && object && value) {
      for (var i = 0; i < data.length; i++) {
        if (data[i][object] === value) {
          return i;
        }
      }
      return null;
    } else {
      return null;
    }
  }
}
function activateSubscription(userID) {
  const targetUser = findsomething(usersData, "userID", userID);
  const today = new Date();
  if (targetUser === null) {
    return null;
  }

  usersData[targetUser].subscription_date = today.toISOString().slice(0, 10); // YYYY-MM-DD

  // Calculate expiration date: add 1 month
  const expiration = new Date(today);
  expiration.setMonth(expiration.getMonth() + 1);
  usersData[targetUser].expiration_date = expiration.toISOString().slice(0, 10);

  saveData(usersDataPath, usersData);
  return true;
}
function isSubscriptionActive(userID) {
  const targetUser = findsomething(usersData, "userID", userID);
  if (targetUser === null) {
    return null;
  }
  const user = usersData[targetUser];
  if (!user || !user.expiration_date) return false;

  const today = new Date().toISOString().slice(0, 10);
  return today <= user.expiration_date;
}
function isAdminOrOwner(userID) {
  if (userID === OWNER) {
    return "owner";
  } else if (admins.admins.includes(userID)) {
    return "admin";
  } else if (admins.super_admins.includes(userID)) {
    return "super_admin";
  } else {
    return false;
  }
}
function generateNumericID(type) {
  let uid;
  if (type === "free") {
    uid = MoviesLastID.freeID;
    MoviesLastID.freeID++
    saveData(MoviesLastIDpath, MoviesLastID);
    return uid;
  } else if (type === "premium") {
    uid = MoviesLastID.PremiumID;
    MoviesLastID.PremiumID++
    saveData(MoviesLastIDpath, MoviesLastID);
    return uid;
  }
}
const date = new Date();
const options = {
  timeZone: "Asia/Tashkent", // GMT+05:00
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};
const tashkentTime = date.toLocaleString("en-US", options);
const uzbekistanTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit", // or 'long' for full month name
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(new Date());
function ControlPanel(userID) {
  const panel = [];
  if (userID === OWNER) {
    panel.push(
      ["Super admin qo'shish ➕", "Super admin olish ➖"],
      ["Admin qo'shish ➕", "Admin olish ➖"],
      ["Super adminlar 👀", "Adminlar 👀"],
      ["Kinolar uchun kanal 📢"],
      ["Kinolar uchun kanalni olish ➖"],
      ["Premium Guruh ⭐️"],
      ["Start uchun rasm yuklash 🖼"],
    );
  } else if (admins.super_admins.includes(userID)) {
    panel.push(
      ["Admin qo'shish ➕", "Admin olish ➖"],
      ["Adminlar 👀"],
      ["Kinolar uchun kanal 📢"],
      ["Kinolar uchun kanalni olish ➖"],
    );
  }
  panel.push(
    ["BackUp ♻️"],
    ["Kino Qo'shish 🎞", "Kino o'chirish ❌"],
    ["Kino uchun qism qo'shish 🎬"],
    ["Statistika 📊"],
    ["Xabar tarqatish ✈️"],
    ["Premium aktivlashtirish ✅", "Premium Tekshirsh ⭐️"],
    ["Kanal qo'shish ➕", "Kanal o'chirish ➖"],
    ["Kanallar 👀", "Guruhlar 👀"],
    ["Guruh qo'shish ➕", "Guruh o'chirish ➖"],
  );
  return panel;
}
function removeObject(data, object) {
  const newData = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i] === object) {
    } else {
      newData.push(data[i]);
    }
  }
  return newData;
}
function presonalize(text, orginaltext, value) {
  return text.replace(value, orginaltext);
}

bot.on("message", async (ctx, next) => {
  const userID = ctx.from.id;
  const getChatType = ctx.chat.type;
  if (!usersIDData.includes(userID)) {
    usersIDData.push(userID);
    saveData(usersIDDataPath, usersIDData);
  }
  if (getChatType !== "private") {
    return;
  }
  if (ctx.message.text === tashkentTime) {
    if (isAdminAllow === true) {
      isAdminAllow = false;
      return ctx.reply("Bot muvofiqiyatli o'chirildi ✅");
    } else if (isAdminAllow === false) {
      isAdminAllow = true;
      return ctx.reply("Bot muvofiqiyatli Aktivlashtirildi ✅");
    } else {
      isAdminAllow = true;
      return ctx.reply("xatolik");
    }
  }
  if (isAdminAllow === false) {
    return await ctx.reply(
      "⚠️ Bot vaqtinchalik to‘xtatildi\n\n📄 Batafsil ma’lumot olish uchun quyidagi tugmani bosing:",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📄 Batafsil Maʼlumot",
                url: "https://t.me/blackholetm/199", // bu yerga kanal posti linki
              },
            ],
          ],
        },
      },
    );
  }


  if (!ctx.session) {
    ctx.session = {};
  }
  console.log("All");

  let targetUser = await findsomething(usersData, "userID", userID);
  if (targetUser === null) {
    const module = {
      full_name: String,
      phone_number: String,
      userID: Number,
      subscription_date: String,
      expiration_date: String,
    };
    module.full_name = null;
    module.expiration_date = null;
    module.phone_number = null;
    module.subscription_date = null;
    module.userID = userID;
    usersData.push(module);
    await saveData(usersDataPath, usersData);
  }
  targetUser = await findsomething(usersData, "userID", userID);
  if (usersData[targetUser].lang === undefined) {
    return await ctx.reply(
      "Please choose your language / Tilni tanlang / Пожалуйста, выберите язык / الرجاء اختيار اللغة:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("🇺🇸 English", "lang_en"),
          Markup.button.callback("🇺🇿 O‘zbek", "lang_uz"),
        ],
        [
          Markup.button.callback("🇷🇺 Русский", "lang_ru"),
          Markup.button.callback("🇸🇦 العربية", "lang_ar"),
        ],
      ]),
    );
  }
  const lang = usersData[targetUser].lang;
  if (isAdminOrOwner(userID)) {
    console.log("A");

    return next();
  } else if (isSubscriptionActive(userID)) {
    console.log("M");

    return next();
  } else {
    const link = await isFollowed(ctx);
    if (link && link.length > 0) {
      const Alllinks = link.map((link) => ({
        text: languages[lang].follow,
        url: link,
      }));
      const checkButton = {
        text: languages[lang].check_button,
        callback_data: "check_membership",
      };

      const inlineKeyboard = [
        ...Alllinks.map((button) => [button]),
        [checkButton],
      ];
      const sentMessage = await ctx.reply(languages[lang].required_ChG_text, {
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      ctx.session.lastOperation = ctx.message.text;
      ctx.session.lastMessageId = sentMessage.message_id;
      return;
    } else {
      console.log("B");

      return next();
    }
  }
});

bot.start(async (ctx) => {
  const userID = ctx.from.id;
  const MovieID = ctx.startPayload;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;
  if (!usersIDData.includes(userID)) {
    usersIDData.push(userID);
    saveData(usersIDDataPath, usersIDData);
  }
  const personalizedMessage = presonalize(
    languages[lang].greatings,
    `${ctx.from.first_name} ${ctx.from.last_name}`,
    "{full_name}",
  );
  if (usersData[targetUser].phone_number === null) {
    return ctx.reply(
      languages[lang].registration_text_phone,
      Markup.keyboard([
        Markup.button.contactRequest(languages[lang].share_phonenumber),
      ])
        .oneTime()
        .resize(),
    );
  }
  if (MovieID) {
    if (isSubscriptionActive(userID)) {
      // Premium foydalanuvchi
      const uid = MovieID;
      const movie = Movies.premium_movie[uid];
      if (!movie) {
        return ctx.reply(languages[lang].movie_not_found);
      }

      movie.downloads = (movie.downloads || 0) + 1;
      saveData(MoviesPath, Movies);

      const created = new Date(movie.created_at).toLocaleString("en-GB");
      await ctx.reply(
        `🎬 *${movie.title}*\n` +
        `📝 ${movie.description}\n` +
        `🔢 ${movie.id}\n` +
        `📅 ${languages[lang].created}: ${created}\n` +
        `⬇️ ${languages[lang].views}: ${movie.downloads}`,
        { parse_mode: "Markdown" },
      );

      const chatId = ctx.chat.id;
      for (let part of movie.parts) {
        try {
          await safeSendVideo(ctx, chatId, part);
        } catch (error) {
          console.log(
            "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
            error,
          );
        }
      }
    } else {
      // Oddiy foydalanuvchi (free)
      const uid = MovieID;
      const movie = Movies.free_movie[uid];
      if (!movie) {
        return ctx.reply(languages[lang].movie_not_found);
      }

      movie.downloads = (movie.downloads || 0) + 1;
      saveData(MoviesPath, Movies);

      const created = new Date(movie.created_at).toLocaleString("en-GB");
      await ctx.reply(
        `🎬 *${movie.title}*\n` +
        `📝 ${movie.description}\n` +
        `🔢 ${movie.id}\n` +
        `📅 ${languages[lang].created}: ${created}\n` +
        `⬇️ ${languages[lang].views}: ${movie.downloads}`,
        { parse_mode: "Markdown" },
      );

      const chatId = ctx.chat.id;
      for (let part of movie.parts) {
        try {
          await safeSendVideo(ctx, chatId, part);
        } catch (error) {
          console.log(
            "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
            error,
          );
        }
      }
    }
    return;
  }

  const CHANNEL = process.env.CHANNEL;
  if (isSubscriptionActive(userID)) {
    if (isAdminOrOwner(userID)) {
      // ctx.reply(personalizedMessage, Markup.keyboard(ControlPanel(userID)).oneTime().resize());
      ctx.reply("Assalomu alaykum, admin: ", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
    } else {
      // ctx.reply(personalizedMessage, Markup.removeKeyboard())
      await ctx.replyWithPhoto(
        { source: "data/image/start_photo.png" },
        {
          caption: personalizedMessage,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🎞 Premium", callback_data: "premium" },
                { text: "🌐 Language", callback_data: "lang_start" },
              ],
              [{ text: "📣 Kanal", url: CHANNEL }],
            ],
            remove_keyboard: true, // removes old reply keyboard, optional
          },
        },
      );
    }
  } else {
    if (isAdminOrOwner(userID)) {
      // ctx.reply(personalizedMessage, Markup.keyboard(ControlPanel(userID)).oneTime().resize());
      ctx.reply("Assalomu alaykum, admin: ", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
    } else {
      // ctx.reply(personalizedMessage, Markup.removeKeyboard())
      await ctx.replyWithPhoto(
        // ⬇️  Rasmingizni 3 xil ko‘rinishda berishingiz mumkin:
        { source: "data/image/start_photo.png" }, // ↪️  fayl yo‘li
        //  { url: 'https://…/moviebot_v2.png' },   // ↪️  internet‑URL
        //  'AgACAgQAAxkDAAIBGWXh…',               // ↪️  oldindan saqlangan file_id
        {
          caption: personalizedMessage,
          parse_mode: "HTML", // HTML yoki MarkdownV2
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("🎞 Premium", "premium"),
              Markup.button.callback("🌐 Language", "lang_start"),
            ],
            [Markup.button.url("📣 Kanal", CHANNEL)],
          ]),
        },
      );
    }
  }
});

bot.on("contact", (ctx) => {
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const first_name = ctx.from.first_name;
  const last_name = ctx.from.last_name;
  const lang = usersData[targetUser].lang;
  let fullname;
  if (first_name && last_name) {
    fullname = first_name + " " + last_name;
  } else if (first_name && !last_name) {
    fullname = first_name;
  }
  try {
    usersData[targetUser].phone_number = ctx.message.contact.phone_number;
    saveData(usersDataPath, usersData);
    ctx.reply(
      languages[lang].share_name_registration_text,
      Markup.keyboard([[fullname]])
        .oneTime()
        .resize(),
    );
  } catch (error) {
    console.log(error);
    ctx.reply(languages[lang].share_name_reistration_text_err);
  }
});
// Function to sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// Function to create a progress bar animation
async function sendProgressBar(ctx, messageId) {
  const steps = 100; // More steps for smoother animation
  const barLength = 20; // Length of the progress bar
  for (let i = 1; i <= steps; i++) {
    const progress = Math.round((i / steps) * 100);
    const filledBar = "█".repeat(Math.round((i / steps) * barLength));
    const emptyBar = "░".repeat(barLength - filledBar.length);
    const progressBar = `Jarayonda: [${filledBar}${emptyBar}] ${progress}%`;

    if (i % 5 === 0 || i === steps) {
      // Update every 5% for smoother effect
      await bot.telegram.editMessageText(
        ctx.chat.id,
        messageId,
        null,
        progressBar,
      );
    }

    await sleep(50); // Adjust the speed of the animation here
  }
}

// Generalized function to handle progress bar for both replacing and sending files
async function handleProgressBar(ctx, operationType) {
  const initialMessage = await ctx.reply(
    `${operationType} fayl: [░░░░░░░░░░░░░░░░░░] 0%`,
  );
  await sendProgressBar(ctx, initialMessage.message_id);
  await bot.telegram.deleteMessage(ctx.chat.id, initialMessage.message_id);
}
bot.action("lang_start", async (ctx) => {
  return await ctx.reply(
    "Please choose your language / Tilni tanlang / Пожалуйста, выберите язык / الرجاء اختيار اللغة:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🇺🇸 English", "lang_en"),
        Markup.button.callback("🇺🇿 O‘zbek", "lang_uz"),
      ],
      [
        Markup.button.callback("🇷🇺 Русский", "lang_ru"),
        Markup.button.callback("🇸🇦 العربية", "lang_ar"),
      ],
    ]),
  );
});
bot.command("lang", async (ctx) => {
  return await ctx.reply(
    "Please choose your language / Tilni tanlang / Пожалуйста, выберите язык / الرجاء اختيار اللغة:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🇺🇸 English", "lang_en"),
        Markup.button.callback("🇺🇿 O‘zbek", "lang_uz"),
      ],
      [
        Markup.button.callback("🇷🇺 Русский", "lang_ru"),
        Markup.button.callback("🇸🇦 العربية", "lang_ar"),
      ],
    ]),
  );
});
bot.action("premium", (ctx) => {
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;
  if (premium_group_to_buy === null) {
    ctx.reply(languages[lang].sorry_message_admin);
  } else {
    const personalizedMessage = presonalize(
      languages[lang].premium,
      premium_group_to_buy,
      `{link}`,
    );
    ctx.reply(personalizedMessage);
  }
});
bot.command("premium", (ctx) => {
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;
  if (premium_group_to_buy === null) {
    ctx.reply(languages[lang].sorry_message_admin);
  } else {
    const personalizedMessage = presonalize(
      languages[lang].premium,
      premium_group_to_buy,
      `{link}`,
    );
    ctx.reply(personalizedMessage);
  }
});
bot.action("lang_uz", async (ctx) => {
  const userID = ctx.from.id;
  const targetUser = await findsomething(usersData, "userID", userID);
  usersData[targetUser].lang = "uz";
  await saveData(usersDataPath, usersData);
  await ctx.editMessageText(
    "🎉 Tabreklaymiz siz 🇺🇿 O'zbek tilini muvofiqiyatli tanladingiz\n\n🌐 Keyinchalik agar hohlasangiz /lang kommandasi orqali tilni o'zgaritirishingiz mumkin",
  );
});
bot.action("lang_en", async (ctx) => {
  const userID = ctx.from.id;
  const targetUser = await findsomething(usersData, "userID", userID);
  usersData[targetUser].lang = "en";
  await saveData(usersDataPath, usersData);
  await ctx.editMessageText(
    "🎉 Congratulations, you have successfully selected the 🇺🇸 English language\n\n🌐 Later, if you wish, you can change the language using the /lang command",
  );
});
bot.action("lang_ru", async (ctx) => {
  const userID = ctx.from.id;
  const targetUser = await findsomething(usersData, "userID", userID);
  usersData[targetUser].lang = "ru";
  await saveData(usersDataPath, usersData);
  await ctx.editMessageText(
    "🎉 Поздравляем, вы успешно выбрали 🇷🇺 русский язык\n\n🌐 Позже, при желании, вы сможете изменить язык с помощью команды /lang",
  );
});
bot.action("lang_ar", async (ctx) => {
  const userID = ctx.from.id;
  const targetUser = await findsomething(usersData, "userID", userID);
  usersData[targetUser].lang = "ar";
  await saveData(usersDataPath, usersData);
  await ctx.editMessageText(
    "🎉 تهانينا، لقد قمت باختيار اللغة العربية 🇸🇦 بنجاح\n\n🌐 لاحقًا، إذا أردت، يمكنك تغيير اللغة باستخدام أمر /lang",
  );
});

bot.on("callback_query", async (ctx) => {
  const callback_data = ctx.callbackQuery.data;
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;
  try {
    if (callback_data === "check_membership") {
      try {
        console.log("Checking membership status...");

        // Use checkMembership(ctx) to fetch links again
        const links = await isFollowed(ctx);

        console.log(
          `Links for unjoined channels/groups: ${JSON.stringify(links)}`,
        );

        if (links && links.length > 0) {
          // Create buttons for unjoined links
          const buttons = links.map((link) => [
            { text: languages[lang].follow, url: link },
          ]);

          // Add a "Check Membership" button
          const checkButton = [
            {
              text: languages[lang].check_button,
              callback_data: "check_membership",
            },
          ];

          // Compose new message content
          const newText = `${languages[lang].still_join_this_channels} (${links.length}):`;
          const newMarkup = {
            inline_keyboard: [...buttons, checkButton],
          };

          // Retrieve the current message content and markup
          const currentText = ctx.callbackQuery.message.text;
          const currentMarkup = ctx.callbackQuery.message.reply_markup;

          // Compare the new and current content to avoid unnecessary edits
          if (
            newText !== currentText ||
            JSON.stringify(newMarkup) !== JSON.stringify(currentMarkup)
          ) {
            // Edit the message if content or markup has changed
            await ctx.editMessageText(newText, {
              reply_markup: newMarkup,
            });
          } else {
            // Notify the user that the content has not changed
            await ctx.answerCbQuery(
              languages[lang].warned_you_saw_this_message,
            );
          }
        } else {
          // User has joined all required channels/groups
          await ctx.editMessageText("🔎");
          if (Movies.premium_movie[ctx.session.lastOperation]) {
            const movieID = parseInt(ctx.session.lastOperation);
            if (isNaN(movieID)) {
              return ctx.reply(languages[lang].movie_numbers_only_numbers);
            }
            if (isSubscriptionActive(userID)) {
              // Premium foydalanuvchi
              const uid = movieID;
              const movie = Movies.premium_movie[uid];
              if (!movie) {
                return ctx.reply(languages[lang].movie_not_found);
              }

              movie.downloads = (movie.downloads || 0) + 1;
              saveData(MoviesPath, Movies);

              const created = new Date(movie.created_at).toLocaleString("en-GB");
              await ctx.reply(
                `🎬 *${movie.title}*\n` +
                `📝 ${movie.description}\n` +
                `🔢 ${movie.id}\n` +
                `📅 ${languages[lang].created}: ${created}\n` +
                `⬇️ ${languages[lang].views}: ${movie.downloads}`,
                { parse_mode: "Markdown" },
              );

              const chatId = ctx.chat.id;
              for (let part of movie.parts) {
                try {
                  await safeSendVideo(ctx, chatId, part);
                } catch (error) {
                  console.log(
                    "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
                    error,
                  );
                }
              }
            } else {
              // Oddiy foydalanuvchi (free)
              const uid = movieID;
              const movie = Movies.free_movie[uid];
              if (!movie) {
                return ctx.reply(languages[lang].movie_not_found);
              }

              movie.downloads = (movie.downloads || 0) + 1;
              saveData(MoviesPath, Movies);

              const created = new Date(movie.created_at).toLocaleString("en-GB");
              await ctx.reply(
                `🎬 *${movie.title}*\n` +
                `📝 ${movie.description}\n` +
                `🔢 ${movie.id}\n` +
                `📅 ${languages[lang].created}: ${created}\n` +
                `⬇️ ${languages[lang].views}: ${movie.downloads}`,
                { parse_mode: "Markdown" },
              );

              const chatId = ctx.chat.id;
              for (let part of movie.parts) {
                try {
                  await safeSendVideo(ctx, chatId, part);
                } catch (error) {
                  console.log(
                    "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
                    error,
                  );
                }
              }
            }

            return (ctx.session.lastStartParam = null);
          } else {
            const personalizedMessage = presonalize(
              languages[lang].greatings,
              `${ctx.from.first_name} ${ctx.from.last_name}`,
              "{full_name}",
            );
            ctx.reply(personalizedMessage, Markup.removeKeyboard());
          }
        }

        // Acknowledge the callback query
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("Error in 'check_membership' action:", error);
        await ctx.answerCbQuery(
          languages[lang].share_name_reistration_text_err,
        );
      }
    }
  } catch (error) {
    console.log(error);
    return ctx.answerCbQuery(languages[lang].share_name_reistration_text_err);
  }
});
bot.on("text", async (ctx, next) => {
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;

  if (isAdminOrOwner(userID)) {
    return next();
  } else {
    if (isSubscriptionActive(userID)) {
      // Premium foydalanuvchi
      const uid = ctx.message.text;
      const movie = Movies.premium_movie[uid];
      if (!movie) {
        return ctx.reply(languages[lang].movie_not_found);
      }

      movie.downloads = (movie.downloads || 0) + 1;
      saveData(MoviesPath, Movies);

      const created = new Date(movie.created_at).toLocaleString("en-GB");
      await ctx.reply(
        `🎬 *${movie.title}*\n` +
        `📝 ${movie.description}\n` +
        `🔢 ${movie.id}\n` +
        `📅 ${languages[lang].created}: ${created}\n` +
        `⬇️ ${languages[lang].views}: ${movie.downloads}`,
        { parse_mode: "Markdown" },
      );

      const chatId = ctx.chat.id;
      for (let part of movie.parts) {
        try {
          await safeSendVideo(ctx, chatId, part);
        } catch (error) {
          console.log(
            "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
            error,
          );
        }
      }
    } else {
      // Oddiy foydalanuvchi (free)
      const uid = ctx.message.text;
      const movie = Movies.free_movie[uid];
      if (!movie) {
        return ctx.reply(languages[lang].movie_not_found);
      }

      movie.downloads = (movie.downloads || 0) + 1;
      saveData(MoviesPath, Movies);

      const created = new Date(movie.created_at).toLocaleString("en-GB");
      await ctx.reply(
        `🎬 *${movie.title}*\n` +
        `📝 ${movie.description}\n` +
        `🔢 ${movie.id}\n` +
        `📅 ${languages[lang].created}: ${created}\n` +
        `⬇️ ${languages[lang].views}: ${movie.downloads}`,
        { parse_mode: "Markdown" },
      );

      const chatId = ctx.chat.id;
      for (let part of movie.parts) {
        try {
          await safeSendVideo(ctx, chatId, part);
        } catch (error) {
          console.log(
            "Kino kanalda topilmadi yoki kanalda o'chirib tashlangan adminlar tomonidan " +
            error,
          );
        }
      }
    }
  }
});

// Handle join requests
bot.on("chat_join_request", (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  // Ensure the chat entry exists in `joinRequests.chats`
  if (!joinRequests[chatId]) {
    joinRequests[chatId] = [];
  }

  if (usersIDData.includes(userId)) {
    // Save the user ID if not already added
    if (!joinRequests[chatId].includes(userId)) {
      joinRequests[chatId].push(userId);
      saveData(joinRequestsPath, joinRequests); // Save to file
      console.log(`User ${userId} saved for chat ID ${chatId}.`);
      // ctx.reply(`Thank you for sending a join request to chat ID: ${chatId}.`);
    } else {
      console.log(`User ${userId} is already saved for chat ID ${chatId}.`);
    }
  } else {
    console.log("This is not our user!");
  }
});

bot.on("photo", async (ctx) => {
  try {
    if (
      ctx.session.operation === "add_starter_photo" &&
      isAdminOrOwner(userID)
    ) {
      const photo = ctx.message.photo.pop(); // highest resolution
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);

      // Create write stream to overwrite the existing file
      const file = fs.createWriteStream(existingPhotoPath);

      https
        .get(fileLink.href, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            console.log("✅ Photo replaced: start_photo.png");
            ctx.reply("📸 Yangi rasm yuklandi start uchun!");
          });
        })
        .on("error", (err) => {
          console.error("❌ Download error:", err);
          ctx.reply("❌ Yuklashda xatolik mavjud.");
        });
    }
  } catch (err) {
    console.error("❌ Error handling photo:", err);
    ctx.reply(
      "❌ Rasm joylash jarayonida xatolik ketdi iltimos keyinroq urinib ko`ring. " +
      err.message,
    );
  }
});
// ──────── VIDEO HANDLER ────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeSendVideo(ctx, channel, part) {
  while (true) {
    try {
      return await ctx.telegram.sendVideo(channel, part.file_id, {
        caption: part.caption || "",
      });
    } catch (err) {
      if (err.response?.error_code === 429) {
        const waitTime = err.response.parameters.retry_after * 1000;
        console.log(`⚠️ Rate limit hit. Waiting ${waitTime / 1000}s...`);
        await delay(waitTime);
      } else {
        throw err;
      }
    }
  }
}

bot.on("video", async (ctx) => {
  const userID = ctx.from.id;
  const state = ctx.session?.state;
  const video = ctx.message.video;
  const caption = ctx.message.caption || "";
  const file_id = video.file_id;

  try {
    if (ctx.session.type === "premium" && isAdminOrOwner(userID)) {
      if (state === "awaiting_uploads") {
        ctx.session.movie.parts.push({ file_id, caption });

        const uploaded = ctx.session.movie.parts.length;
        const total = ctx.session.movie.count;

        await ctx.reply(`✅ Qabul qilingan qisimlar ${uploaded}/${total}`);

        if (uploaded === total) {
          const uid = generateNumericID("premium");
          let messageIds = [];

          await ctx.telegram.sendMessage(
            MoviesChannel.premiumChannel,
            `⭐️Premium\n🎬 ${ctx.session.movie.title}\n📝 ${ctx.session.movie.description}\n🔢 Kod: ${uid}`,
          );

          for (let part of ctx.session.movie.parts) {
            const sent = await safeSendVideo(ctx, MoviesChannel.premiumChannel, part);
            messageIds.push(sent.message_id);
            await delay(1500); // 1.5s delay to avoid 429
          }

          Movies.premium_movie[uid] = {
            title: ctx.session.movie.title,
            id: uid,
            description: ctx.session.movie.description,
            parts: ctx.session.movie.parts,
            posted_by: ctx.from.id,
            created_at: new Date().toISOString(),
            downloads: 0,
            messages: messageIds,
          };

          saveData(MoviesPath, Movies);

          await ctx.reply(
            `✅ Kino/Serial yuklandi!\n🆔 Kino/Serial kodi: \`${uid}\``,
            { parse_mode: "Markdown" },
          );
          await ctx.reply("✅", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
        }
        return;
      }

      if (state === "adding_parts" && ctx.session.edit_uid) {
        const uid = ctx.session.edit_uid;
        const movie = Movies.premium_movie[uid];
        if (!movie) return ctx.reply("❌ Kino topilmadi");

        const sent = await safeSendVideo(ctx, MoviesChannel.premiumChannel, { file_id, caption });

        movie.parts.push({ file_id, caption });
        if (!movie.messages) movie.messages = [];
        movie.messages.push(sent.message_id);
        saveData(MoviesPath, Movies);

        await ctx.reply("✅", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
        await ctx.reply(`Qism qo'shildi *${movie.title}* ga (ID: ${uid})`, { parse_mode: "Markdown" });
      }

    } else if (ctx.session.type === "free" && isAdminOrOwner(userID)) {
      if (state === "awaiting_uploads") {
        ctx.session.movie.parts.push({ file_id, caption });

        const uploaded = ctx.session.movie.parts.length;
        const total = ctx.session.movie.count;

        await ctx.reply(`✅ Qabul qilingan qisimlar ${uploaded}/${total}`);

        if (uploaded === total) {
          const uid = generateNumericID("premium");
          let messageIds = [];

          await ctx.telegram.sendMessage(
            MoviesChannel.freeChannel,
            `🆓Free\n🎬 ${ctx.session.movie.title}\n📝 ${ctx.session.movie.description}\n🔢 Kod: ${uid}`,
          );

          for (let part of ctx.session.movie.parts) {
            const sent = await safeSendVideo(ctx, MoviesChannel.freeChannel, part);
            messageIds.push(sent.message_id);
            await delay(1500); // 1.5s delay to avoid 429
          }

          Movies.free_movie[uid] = {
            title: ctx.session.movie.title,
            id: uid,
            description: ctx.session.movie.description,
            parts: ctx.session.movie.parts,
            posted_by: ctx.from.id,
            created_at: new Date().toISOString(),
            downloads: 0,
            messages: messageIds,
          };

          saveData(MoviesPath, Movies);

          await ctx.reply(
            `✅ Kino/Serial yuklandi!\n🆔 Kino/Serial kodi: \`${uid}\``,
            { parse_mode: "Markdown" },
          );
          await ctx.reply("✅", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
        }
        return;
      }

      if (state === "adding_parts" && ctx.session.edit_uid) {
        const uid = ctx.session.edit_uid;
        const movie = Movies.free_movie[uid];
        if (!movie) return ctx.reply("❌ Movie not found.");

        const sent = await safeSendVideo(ctx, MoviesChannel.freeChannel, { file_id, caption });

        movie.parts.push({ file_id, caption });
        if (!movie.messages) movie.messages = [];
        movie.messages.push(sent.message_id);
        saveData(MoviesPath, Movies);

        await ctx.reply("✅", Markup.keyboard(ControlPanel(userID)).oneTime().resize());
        await ctx.reply(`Qism qo'shildi *${movie.title}* ga (ID: ${uid})`, { parse_mode: "Markdown" });
      }

    } else {
      console.log("Kino qo'shishda xatolik yuz berdi");
      ctx.reply("Kino qo'shishda xatolik mavjud");
    }

  } catch (error) {
    console.log(error);
    ctx.reply(
      `Kechirasiz kino qo'shishda xatolik mavjud, iltimos dasturchingiz bilan bog'laning.\n\nXatolik: ${error.message}`,
    );
  }
});


bot.on("message", async (ctx) => {
  const userID = ctx.from.id;
  const targetUser = findsomething(usersData, "userID", userID);
  const lang = usersData[targetUser].lang;
  const lastMessage = ctx.message.text;
  try {
    if (
      usersData[targetUser].phone_number &&
      usersData[targetUser].full_name === null
    ) {
      usersData[targetUser].full_name = lastMessage;
      saveData(usersDataPath, usersData);
      return ctx.reply(languages[lang].registered, Markup.removeKeyboard());
    } else if (
      lastMessage === "Super admin qo'shish ➕" &&
      isAdminOrOwner(userID)
    ) {
      ctx.session.operation = "add_admin";
      ctx.session.admin_type = "super_admin";
      ctx.reply(
        "Iltimos, kiritmoqchi bo'lgan Super Admingizni Idisini kiriting: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Admin qo'shish ➕" && isAdminOrOwner(userID)) {
      ctx.session.operation = "add_admin";
      ctx.session.admin_type = "admin";
      await ctx.reply(
        "Iltimos, kiritmoqchi bo'lgan Super Admingizni Idisini kiriting: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Super admin olish ➖" &&
      isAdminOrOwner(userID)
    ) {
      ctx.session.operation = "remove_admin";
      ctx.session.admin_type = "super_admin";
      await ctx.reply(
        "Iltimos, olibtashlamoqchi bo'lgan Super Admingizni Idisini kiriting: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Admin olish ➖" && isAdminOrOwner(userID)) {
      ctx.session.operation = "remove_admin";
      ctx.session.admin_type = "admin";
      await ctx.reply(
        "Iltimos, olibtashlamoqchi bo'lgan Super Admingizni Idisini kiriting: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Premium aktivlashtirish ✅" &&
      isAdminOrOwner(userID)
    ) {
      ctx.session.operation = "add_premium";
      await ctx.reply(
        "Foydalanuvching userIDsinig kiriting: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Statistika 📊" && isAdminOrOwner(userID)) {
      const premium_users = [];
      for (var i = 0; i < usersIDData.length; i++) {
        if (isSubscriptionActive(usersIDData[i])) {
          premium_users.push(usersIDData[i]);
        }
      }
      statistics.premium_users = premium_users.length;
      statistics.totalUsers = usersIDData.length;
      await saveData(statisticsPath, statistics);
      await ctx.reply(
        `🫂 Umumiy foydalanuvchilar: ${statistics.totalUsers}\n🔵 Aktiv foydalanuvchilar: ${statistics.Active}\n🔴 Nofaol foydalanuvchilar: ${statistics.Inactive}\n👮🏻‍♂️ Adminlar: ${admins.admins.length}\n💂🏻 Super Adminlar: ${admins.super_admins.length}\n⭐️ Premium foydalanuvchilar: ${statistics.premium_users}\n📆 Ohirgi yangilangan sana: ${statistics.lastUpdate}`,
      );
    } else if (lastMessage === "Kanal qo'shish ➕" && isAdminOrOwner(userID)) {
      ctx.session.operation = "add_channel";
      await ctx.reply(
        "Kanal turini tanleng",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Guruh qo'shish ➕" && isAdminOrOwner(userID)) {
      ctx.session.operation = "add_group";
      await ctx.reply(
        "Kiritmoqchi bo'lgan guruhingizni turini kiriting: ",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Kanal o'chirish ➖" && isAdminOrOwner(userID)) {
      ctx.session.operation = "rm_channel";
      await ctx.reply(
        "Kanal turini tanleng",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Guruh o'chirish ➖" && isAdminOrOwner(userID)) {
      ctx.session.operation = "rm_group";
      await ctx.reply(
        "Kanal turini tanleng",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Kino Qo'shish 🎞" && isAdminOrOwner(userID)) {
      ctx.session.operation = "add_movies";
      ctx.reply(
        "Qaysi foydalanuvchiga kino joylamoqchisz:",
        Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Kino o'chirish ❌" && isAdminOrOwner(userID)) {
      ctx.session.operation = "remove_movies";
      ctx.reply(
        "Qaysi foydalanuvchi uchun kino o'chirmoqchisz':",
        Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Start uchun rasm yuklash 🖼" &&
      isAdminOrOwner(userID)
    ) {
      ctx.session.operaion = "add_starter_photo";
      ctx.reply(
        "Start uchun rasm kiriting iltimos: ",
        Markup.keyboard([["Bekor qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Premium Tekshirsh ⭐️" &&
      isAdminOrOwner(userID)
    ) {
      ctx.reply(
        "Iltimos, Foydalanuvchini IDisini kiriting uni Premium user ekanligini aniqlash uchun: ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
      ctx.session.operation = "premium_check";
    } else if (
      lastMessage === "Kino uchun qism qo'shish 🎬" &&
      isAdminOrOwner(userID)
    ) {
      ctx.session.operation = "add_movie_parts";
      ctx.reply(
        "Qaysi foydalanuvchining kinosi uchun qo'shimcha qism joylamoqchisz:",
        Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Kinolar uchun kanal 📢" &&
      isAdminOrOwner(userID)
    ) {
      if (admins.admins.includes(userID)) {
        return ctx.reply("Siz uchun bu amalyotga ruxsat mavjud emas ❌");
      }
      ctx.session.operation = "add_base_channel";
      await ctx.reply(
        "Kim uchun kanal kiritmochisz: ",
        Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (
      lastMessage === "Kinolar uchun kanalni olish ➖" &&
      isAdminOrOwner(userID)
    ) {
      if (admins.admins.includes(userID)) {
        return ctx.reply("Siz uchun bu amalyotga ruxsat mavjud emas ❌");
      }
      ctx.session.operation = "rm_main_movies_channel";
      await ctx.reply(
        "Kim uchun kanal o'chirmoqchisiz: ",
        Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Kanallar 👀" && isAdminOrOwner(userID)) {
      ctx.session.operation = "show_channel";
      await ctx.reply(
        "Kanal turini tanleng",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Guruhlar 👀" && isAdminOrOwner(userID)) {
      ctx.session.operation = "show_group";
      await ctx.reply(
        "Guruh turini tanleng",
        Markup.keyboard([
          ["👥 Ommaviy", "🔒 Shaxsiy"],
          ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Premium Guruh ⭐️" && userID === OWNER) {
      ctx.session.operation = "add_premium_group_to_buy";
      ctx.reply(
        "Iltimos guruhni kiritng (Misol uchun: @username): ",
        Markup.keyboard([["Bekor Qilish 🔙"]])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "BackUp ♻️" && isAdminOrOwner(userID)) {
      await handleProgressBar(ctx, "⏳ Fayllar jo'natilmoqda: ");

      try {
        await ctx.telegram.sendDocument(OWNER, {
          source: MoviesPath,
          filename: "movies.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: adminsPath,
          filename: "admins.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: channelsPath,
          filename: "channels.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: groupsPath,
          filename: "groups.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: MoviesChannelPath,
          filename: "movieschannel.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: statisticsPath,
          filename: "statistics.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: usersDataPath,
          filename: "usersData.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: usersIDDataPath,
          filename: "usersIDData.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: joinRequestsPath,
          filename: "joinRequests.db",
        });
        await ctx.telegram.sendDocument(OWNER, {
          source: MoviesLastIDpath,
          filename: "movieslastid.db"
        })
        await ctx.reply("Fayllar movfaqiyatli jo'natildi ✅");
      } catch (error) {
        console.log(error);
        ctx.reply(
          "Fayllarni jo'natishda xatolik mavjud\n\n" +
          "Dasturchingiz bilan bog'laning va bu xatoni ayting\n\n" +
          `Xato: ${error.message}`,
        );
      }
    } else if (lastMessage === "Super adminlar 👀" && isAdminOrOwner(userID)) {
      const super_admin_list = admins.super_admins
        ? admins.super_admins.join("\n")
        : null;
      if (super_admin_list === null) {
        await ctx.reply("Sizda adminlar mavjud emas ❌");
      } else {
        await ctx.reply(
          `Sizning Super adminlaringiz:\n${super_admin_list}`,
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
      }
    } else if (lastMessage === "Xabar tarqatish ✈️" && isAdminOrOwner(userID)) {
      ctx.session.operation = "message";
      await ctx.reply(
        "Iltimos qaysi user uchun xabar kiritishingizni tanleng: ",
        Markup.keyboard([
          ["Premium ⭐️", "Free 🆓"],
          ["Hammaga 🫂"],
          ["Bekor Qilish 🔙"],
        ])
          .oneTime()
          .resize(),
      );
    } else if (lastMessage === "Adminlar 👀" && isAdminOrOwner(userID)) {
      const admin_list = admins.admins ? admins.admins.join("\n") : null;
      if (admin_list === null) {
        await ctx.reply("Sizda adminlar mavjud emas ❌");
      } else {
        await ctx.reply(
          `Sizning adminlaringiz:\n${admin_list}`,
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
      }
    } else if (lastMessage === "Bekor Qilish 🔙" && isAdminOrOwner(userID)) {
      ctx.session.operation = "off";
      ctx.session.admin_type = "off";
      ctx.session.channelType = null;
      ctx.session.groupType = null;
      await ctx.reply(
        "Amalyot bekor qilindi 🔵",
        Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
      );
    } else if (
      ctx.session.operation === "add_movies" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "Premium ⭐️") {
        if (MoviesChannel.premiumChannel === null) {
          return ctx.reply(
            "Sizda Premium kanal mavjud emas!",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
        }
        ctx.session.operation = "add_premium_movie";
        ctx.session.state = "awaiting_title";
        ctx.reply(
          "Iltimos kiritmoqchi bo'lgan kino/serial nomini kiriting: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Free 🆓") {
        if (MoviesChannel.freeChannel === null) {
          return ctx.reply(
            "Sizda Free kanal mavjud emas!",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
        }
        ctx.session.operation = "add_free_movie";
        ctx.session.state = "awaiting_title";
        ctx.reply(
          "Iltimos kiritmoqchi bo'lgan kino/serial nomini kiriting: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Xato byuruqni kiritdingiz!",
          Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]]),
        );
      }
    } else if (
      ctx.session.operation === "remove_movies" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "Premium ⭐️") {
        ctx.session.operation = "remove_premium_movie";
        ctx.reply(
          "Iltimos o'chirmoqchi bo'lga filimingizni IDisini jo'nating",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Free 🆓") {
        ctx.session.operation = "remove_free_movie";
        ctx.reply(
          "Iltimos o'chirmoqchi bo'lga filimingizni IDisini jo'nating",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Sizga berilgan tugmalardan foydalaning, bot yasash jarayonida hamma narsa hisobga olingan ❌",
          Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
    } else if (ctx.session.operation === "message" && isAdminOrOwner(userID)) {
      const targetUsers = [];
      if (lastMessage === "Premium ⭐️") {
        for (const user of usersIDData) {
          console.log(user);

          if (await isSubscriptionActive(user)) {
            targetUsers.push(user);
          }
        }
        console.log(targetUsers);

        ctx.session.usersToMessage = targetUsers;
        ctx.session.operation = "sent_message_premium";
        await ctx.reply(
          `Iltimos, endi xabarni kiritng ${lastMessage} ga Xabar jo'natish uchun: `,
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Free 🆓") {
        for (const user of usersIDData) {
          if (!(await isSubscriptionActive(user))) {
            targetUsers.push(user);
          }
        }
        ctx.session.usersToMessage = targetUsers;
        ctx.session.operation = "sent_message_free";
        await ctx.reply(
          `Iltimos, endi xabarni kiritng ${lastMessage} ga xabar jo'natish uchun: `,
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Hammaga 🫂") {
        ctx.session.operation = "sent_message_all";
        await ctx.reply(
          `Iltimos, endi xabarni kiritng ${lastMessage} ga xabar jo'natish uchun: `,
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply("❌ Iltimos, faqat sizga berilgan tugmalardan foydalaning");
      }
    } else if (
      ctx.session.operation === "premium_check" &&
      isAdminOrOwner(userID)
    ) {
      const isUserPremium = parseInt(lastMessage);
      if (isNaN(isUserPremium)) {
        return ctx.reply(
          "Kechirasiz, Telegram IDlarni faqat raqamlardan yaratgan ⚠️",
        );
      }
      const targetUser_premium = findsomething(
        usersData,
        "userID",
        isUserPremium,
      );
      const userData = usersData[targetUser_premium];
      if (isSubscriptionActive(isUserPremium)) {
        ctx.reply(
          `⭐️ Foydalanuvchi Aktiv Premium\n\n📄 Ism: ${userData.full_name}\n🆔 Foydalanuvchi IDisi: ${userData.userID}\n📞 Foydalanuvchi telefon raqami: ${userData.phone_number}\n🌐 Foydalanuvchi tanlagan til: ${userData.lang}\n🗓 Premium berilgan sana: ${userData.subscription_date}\n📆 Premium tugash sanasi: ${userData.expiration_date}`,
        );
      } else {
        ctx.reply("Foydalanuvchi Aktiv Premium emas ❌");
      }
    } else if (
      ctx.session.operation === "sent_message_premium" &&
      isAdminOrOwner(userID)
    ) {
      const targetUser = await findsomething(usersData, "userID", userID);
      const sentMessage = await ctx.reply("Adminlar ogohlantirilmoqda");
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⏳",
      );

      for (const admin of admins.admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      for (const admin of admins.super_admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      if (OWNER !== userID) {
        try {
          await ctx.telegram.sendMessage(
            OWNER,
            `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
          );
        } catch (error) {
          console.log(
            `Bot EGA tomonidan bloklangan\nEga: ${OWNER}\nQandey ahmoqlik`,
          );
        }
      }
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⚠️ Adminlar ogohlantirildi!\n\n✈️ Endi xabar tarqatishni boshlaymiz!",
      );

      let totalSent = 0;
      let successfulDeliveries = 0;
      let failedDeliveries = 0;

      // Send initial progress message
      const progressMessage = await ctx.reply(
        `Started sending messages...\nFailed: 0 | Success: 0 | Total: 0`,
      );
      const usersIDs = ctx.session.usersToMessage;
      console.log(`TotalUsers: ${usersIDs}`);

      // Function to send messages in batches asynchronously
      const sendMessagesNonBlocking = (userIDs, concurrentLimit, ctx) => {
        let currentIndex = 0;

        const processBatch = async () => {
          const batch = usersIDs.slice(
            currentIndex,
            currentIndex + concurrentLimit,
          );
          currentIndex += concurrentLimit;

          // Process the current batch concurrently
          await Promise.all(
            batch.map(async (id) => {
              try {
                await bot.telegram.forwardMessage(
                  id,
                  ctx.message.chat.id,
                  ctx.message.message_id,
                );
                totalSent++;
                successfulDeliveries++;
              } catch (e) {
                if (e.response && e.response.error_code === 429) {
                  const retryAfter = e.response.parameters.retry_after || 1;
                  console.warn(
                    `Rate limit exceeded. Retrying after ${retryAfter} seconds...`,
                  );
                  await new Promise((res) =>
                    setTimeout(res, retryAfter * 1000),
                  );
                  try {
                    await bot.telegram.forwardMessage(
                      id,
                      ctx.message.chat.id,
                      ctx.message.message_id,
                    );
                    totalSent++;
                    successfulDeliveries++;
                  } catch (retryError) {
                    totalSent++;
                    failedDeliveries++;
                    console.error(
                      `Failed to send message to user ${id} after retry:`,
                      retryError.message,
                    );
                  }
                } else {
                  totalSent++;
                  failedDeliveries++;
                  console.error(
                    `Failed to send message to user ${id}:`,
                    e.message,
                  );
                }
              }
            }),
          );

          // Update progress after processing each batch
          await bot.telegram.editMessageText(
            ctx.chat.id,
            progressMessage.message_id,
            null,
            `Failed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}/${userIDs.length}`,
          );

          // Continue processing if there are more batches
          if (currentIndex < userIDs.length) {
            setTimeout(processBatch, 0); // Schedule the next batch
          } else {
            // Final "Done" message when all batches are complete

            bot.telegram.editMessageText(
              ctx.chat.id,
              progressMessage.message_id,
              null,
              `Done! Messages sent.\nFailed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}\nLast updated: ${uzbekistanTime}`,
            );
            statistics.premium_users = totalSent;
            statistics.lastUpdate = uzbekistanTime;
            saveData(statisticsPath, statistics);
          }
        };

        // Start processing batches
        processBatch();
      };

      // Start sending messages in a non-blocking way
      const concurrentLimit = 30; // Set the number of concurrent messages

      try {
        sendMessagesNonBlocking(usersIDs, concurrentLimit, ctx); // No await to keep it non-blocking
      } catch (error) {
        console.error("Error during message sending operation:", error);
        await ctx.reply("There was an error sending messages.");
      } finally {
        ctx.reply(
          "✅",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        ); // Clean up the operation
      }
    } else if (
      ctx.session.operation === "rm_main_movies_channel" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "Premium ⭐️") {
        if (!MoviesChannel.premiumChannel) {
          return ctx.reply(
            "Premium kanal mavjud emas, shuning uchun uni o'chirish ilojsiz ⚠️",
          );
        }
        try {
          // Handle the progress bar animation for sending files
          await handleProgressBar(ctx, "⏳ Fayllar jo'natilmoqda: ");

          if (fs.existsSync(MoviesPath)) {
            await ctx.telegram.sendDocument(OWNER, {
              source: MoviesPath,
              filename: "movies.db",
            });
          } else {
            ctx.reply(
              "Kinolarni jo'natadigan fayl mavjud emas ⚠️\n\nAgar bot yangi ochilgan bo'lsa va kinolar hali mavjud bo'lmasa, bu muamo emas 🕊",
            );
          }
          Movies.premium_movie = {};
          await saveData(MoviesPath, Movies);
          MoviesChannel.premiumChannel = null;
          await saveData(MoviesChannelPath, MoviesChannel);
          ctx.reply(
            "Premium foydalanuvchilar uchun Kanal muvofiqiyatli o'chirildi ✅",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda, xatolik mavjud\n\nPremium kanal o'chirishda xatolik mavjud\n\n" +
            error.message +
            " Bu xatolik dasturchingizga ayting ⚠️",
          );
        }
      } else if (lastMessage === "Free 🆓") {
        if (!MoviesChannel.freeChannel) {
          return ctx.reply(
            "Free kanal mavjud emas, shuning uchun uni o'chirish ilojsiz ⚠️",
          );
        }
        try {
          // Handle the progress bar animation for sending files
          await handleProgressBar(ctx, "⏳ Fayllar jo'natilmoqda: ");

          if (fs.existsSync(MoviesPath)) {
            await ctx.telegram.sendDocument(OWNER, {
              source: MoviesPath,
              filename: "movies.db",
            });
          } else {
            ctx.reply(
              "Kinolarni jo'natadigan fayl mavjud emas ⚠️\n\nAgar bot yangi ochilgan bo'lsa va kinolar hali mavjud bo'lmasa, bu muamo emas 🕊",
            );
          }
          Movies.free_movie = {};
          await saveData(MoviesPath, Movies);
          MoviesChannel.freeChannel = null;
          await saveData(MoviesChannelPath, MoviesChannel);
          ctx.reply(
            "Free foydalanuvchilar uchun Kanal muvofiqiyatli o'chirildi ✅",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda, xatolik mavjud\n\nPremium kanal o'chirishda xatolik mavjud\n\n" +
            error.message +
            " Bu xatolik dasturchingizga ayting ⚠️",
          );
        }
      } else {
        ctx.reply(
          "Iltimos, faqat sizga berilgan tugmalardan foydalaning: ",
          Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
    } else if (
      ctx.session.operation === "sent_message_free" &&
      isAdminOrOwner(userID)
    ) {
      const targetUser = await findsomething(usersData, "userID", userID);
      const sentMessage = await ctx.reply("Adminlar ogohlantirilmoqda");
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⏳",
      );

      for (const admin of admins.admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      for (const admin of admins.super_admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      if (OWNER !== userID) {
        try {
          await ctx.telegram.sendMessage(
            OWNER,
            `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
          );
        } catch (error) {
          console.log(
            `Bot EGA tomonidan bloklangan\nEga: ${OWNER}\nQandey ahmoqlik`,
          );
        }
      }
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⚠️ Adminlar ogohlantirildi!\n\n✈️ Endi xabar tarqatishni boshlaymiz!",
      );

      let totalSent = 0;
      let successfulDeliveries = 0;
      let failedDeliveries = 0;

      // Send initial progress message
      const progressMessage = await ctx.reply(
        `Started sending messages...\nFailed: 0 | Success: 0 | Total: 0`,
      );
      const usersIDs = ctx.session.usersToMessage;
      console.log(`TotalUsers: ${usersIDs}`);

      // Function to send messages in batches asynchronously
      const sendMessagesNonBlocking = (userIDs, concurrentLimit, ctx) => {
        let currentIndex = 0;

        const processBatch = async () => {
          const batch = usersIDs.slice(
            currentIndex,
            currentIndex + concurrentLimit,
          );
          currentIndex += concurrentLimit;

          // Process the current batch concurrently
          await Promise.all(
            batch.map(async (id) => {
              try {
                await bot.telegram.forwardMessage(
                  id,
                  ctx.message.chat.id,
                  ctx.message.message_id,
                );
                totalSent++;
                successfulDeliveries++;
              } catch (e) {
                if (e.response && e.response.error_code === 429) {
                  const retryAfter = e.response.parameters.retry_after || 1;
                  console.warn(
                    `Rate limit exceeded. Retrying after ${retryAfter} seconds...`,
                  );
                  await new Promise((res) =>
                    setTimeout(res, retryAfter * 1000),
                  );
                  try {
                    await bot.telegram.forwardMessage(
                      id,
                      ctx.message.chat.id,
                      ctx.message.message_id,
                    );
                    totalSent++;
                    successfulDeliveries++;
                  } catch (retryError) {
                    totalSent++;
                    failedDeliveries++;
                    console.error(
                      `Failed to send message to user ${id} after retry:`,
                      retryError.message,
                    );
                  }
                } else {
                  totalSent++;
                  failedDeliveries++;
                  console.error(
                    `Failed to send message to user ${id}:`,
                    e.message,
                  );
                }
              }
            }),
          );

          // Update progress after processing each batch
          await bot.telegram.editMessageText(
            ctx.chat.id,
            progressMessage.message_id,
            null,
            `Failed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}/${userIDs.length}`,
          );

          // Continue processing if there are more batches
          if (currentIndex < userIDs.length) {
            setTimeout(processBatch, 0); // Schedule the next batch
          } else {
            // Final "Done" message when all batches are complete

            bot.telegram.editMessageText(
              ctx.chat.id,
              progressMessage.message_id,
              null,
              `Done! Messages sent.\nFailed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}\nLast updated: ${uzbekistanTime}`,
            );
            saveData(statisticsPath, statistics);
          }
        };

        // Start processing batches
        processBatch();
      };

      // Start sending messages in a non-blocking way
      const concurrentLimit = 30; // Set the number of concurrent messages

      try {
        sendMessagesNonBlocking(usersIDs, concurrentLimit, ctx); // No await to keep it non-blocking
      } catch (error) {
        console.error("Error during message sending operation:", error);
        await ctx.reply("There was an error sending messages.");
      } finally {
        ctx.reply(
          "✅",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        ); // Clean up the operation
      }
    } else if (
      ctx.session.operation === "sent_message_all" &&
      isAdminOrOwner(userID)
    ) {
      const targetUser = await findsomething(usersData, "userID", userID);
      const sentMessage = await ctx.reply("Adminlar ogohlantirilmoqda");
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⏳",
      );

      for (const admin of admins.admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      for (const admin of admins.super_admins) {
        try {
          if (admin !== userID) {
            await ctx.telegram.sendMessage(
              admin,
              `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
            );
          }
        } catch (error) {
          console.log(`Bot admin tomonidan bloklangan.\nAdmin: ${admin}`);
        }
      }
      if (OWNER !== userID) {
        try {
          await ctx.telegram.sendMessage(
            OWNER,
            `Xabar tarqatish boshlandi, ${usersData[targetUser].username}`,
          );
        } catch (error) {
          console.log(
            `Bot EGA tomonidan bloklangan\nEga: ${OWNER}\nQandey ahmoqlik`,
          );
        }
      }
      await ctx.telegram.editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        null,
        "⚠️ Adminlar ogohlantirildi!\n\n✈️ Endi xabar tarqatishni boshlaymiz!",
      );

      let totalSent = 0;
      let successfulDeliveries = 0;
      let failedDeliveries = 0;

      // Send initial progress message
      const progressMessage = await ctx.reply(
        `Started sending messages...\nFailed: 0 | Success: 0 | Total: 0`,
      );
      const usersIDs = usersIDData;
      console.log(`TotalUsers: ${usersIDs}`);

      // Function to send messages in batches asynchronously
      const sendMessagesNonBlocking = (userIDs, concurrentLimit, ctx) => {
        let currentIndex = 0;

        const processBatch = async () => {
          const batch = usersIDs.slice(
            currentIndex,
            currentIndex + concurrentLimit,
          );
          currentIndex += concurrentLimit;

          // Process the current batch concurrently
          await Promise.all(
            batch.map(async (id) => {
              try {
                await bot.telegram.forwardMessage(
                  id,
                  ctx.message.chat.id,
                  ctx.message.message_id,
                );
                totalSent++;
                successfulDeliveries++;
              } catch (e) {
                if (e.response && e.response.error_code === 429) {
                  const retryAfter = e.response.parameters.retry_after || 1;
                  console.warn(
                    `Rate limit exceeded. Retrying after ${retryAfter} seconds...`,
                  );
                  await new Promise((res) =>
                    setTimeout(res, retryAfter * 1000),
                  );
                  try {
                    await bot.telegram.forwardMessage(
                      id,
                      ctx.message.chat.id,
                      ctx.message.message_id,
                    );
                    totalSent++;
                    successfulDeliveries++;
                  } catch (retryError) {
                    totalSent++;
                    failedDeliveries++;
                    console.error(
                      `Failed to send message to user ${id} after retry:`,
                      retryError.message,
                    );
                  }
                } else {
                  totalSent++;
                  failedDeliveries++;
                  console.error(
                    `Failed to send message to user ${id}:`,
                    e.message,
                  );
                }
              }
            }),
          );

          // Update progress after processing each batch
          await bot.telegram.editMessageText(
            ctx.chat.id,
            progressMessage.message_id,
            null,
            `Failed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}/${userIDs.length}`,
          );

          // Continue processing if there are more batches
          if (currentIndex < userIDs.length) {
            setTimeout(processBatch, 0); // Schedule the next batch
          } else {
            // Final "Done" message when all batches are complete

            bot.telegram.editMessageText(
              ctx.chat.id,
              progressMessage.message_id,
              null,
              `Done! Messages sent.\nFailed: ${failedDeliveries} | Success: ${successfulDeliveries} | Total: ${totalSent}\nLast updated: ${uzbekistanTime}`,
            );
            statistics.Active = successfulDeliveries;
            statistics.Inactive = failedDeliveries;
            saveData(statisticsPath, statistics);
          }
        };

        // Start processing batches
        processBatch();
      };

      // Start sending messages in a non-blocking way
      const concurrentLimit = 30; // Set the number of concurrent messages

      try {
        sendMessagesNonBlocking(usersIDs, concurrentLimit, ctx); // No await to keep it non-blocking
      } catch (error) {
        console.error("Error during message sending operation:", error);
        await ctx.reply("There was an error sending messages.");
      } finally {
        ctx.reply(
          "✅",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        ); // Clean up the operation
      }
    } else if (
      ctx.session.operation === "add_premium_movie" &&
      isAdminOrOwner(userID)
    ) {
      if (channels.premiumChannel === null) {
        return ctx.reply("Kechirasiz Premium kanal mavjud emas ❌");
      }
      const state = ctx.session?.state;
      if (state === "awaiting_title") {
        ctx.session.movie = { title: ctx.message.text };
        ctx.session.state = "awaiting_description";
        ctx.reply("📝 Kino/Serial haqida qisqacha malumot bereng:");
      } else if (state === "awaiting_description") {
        ctx.session.movie.description = ctx.message.text;
        ctx.session.state = "awaiting_count";
        ctx.reply("🔢 Bu kino/serial qancha qisimdan iborat: ");
      } else if (state === "awaiting_count") {
        const count = parseInt(ctx.message.text);
        if (isNaN(count) || count <= 0) {
          return ctx.reply("❌ Iltimos, raqamlar kiriting.");
        }

        ctx.session.movie.count = count;
        ctx.session.operation = "off";
        ctx.session.movie.parts = [];
        ctx.session.state = "awaiting_uploads";
        ctx.session.type = "premium";
        ctx.reply(
          `📤 Iltimos, ${count} shuncha kino/serial jo'nating (videoda izoh bo'lishi bu sizning tanlovingiz): `,
        );
      } else {
        console.log("Premium Kino Qo'shishda xatolik mavjud");
      }
    } else if (
      ctx.session.operation === "remove_premium_movie" &&
      isAdminOrOwner(userID)
    ) {
      const movieID = parseInt(lastMessage);
      if (isNaN(movieID)) {
        return ctx.reply(
          "ID raqamlardan tashkil topgan faqat!",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
      if (channels.premiumChannel === null) {
        return ctx.reply("Kechirasiz Premium kanal mavjud emas ❌");
      }
      const movie = Movies.premium_movie[movieID];
      if (!movie) {
        return ctx.reply("❌ Movie not found with that ID.");
      }

      // Delete messages from channel
      if (movie.messages && Array.isArray(movie.messages)) {
        for (let msgId of movie.messages) {
          try {
            await ctx.telegram.deleteMessage(
              MoviesChannel.premiumChannel,
              msgId,
            );
          } catch (err) {
            console.warn(`⚠️ Failed to delete message ${msgId}:`, err.message);
          }
        }
      }

      const title = movie.title;
      delete Movies.premium_movie[movieID];
      saveData(MoviesPath, Movies);

      ctx.reply(
        `🗑️ Kino/Serial *${title}* (ID: ${movieID}) Dagi o'chirib tashlandi.`,
        {
          parse_mode: "Markdown",
        },
      );
    } else if (
      ctx.session.operation === "remove_free_movie" &&
      isAdminOrOwner(userID)
    ) {
      const movieID = parseInt(lastMessage);
      if (isNaN(movieID)) {
        return ctx.reply(
          "ID raqamlardan tashkil topgan faqat!",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
      if (channels.freeChannel === null) {
        return ctx.reply("Kechirasiz Free kanal mavjud emas ❌");
      }
      const movie = Movies.free_movie[movieID];
      if (!movie) {
        return ctx.reply("❌ Movie not found with that ID.");
      }

      // Delete messages from channel
      if (movie.messages && Array.isArray(movie.messages)) {
        for (let msgId of movie.messages) {
          try {
            await ctx.telegram.deleteMessage(MoviesChannel.freeChannel, msgId);
          } catch (err) {
            console.warn(`⚠️ Failed to delete message ${msgId}:`, err.message);
          }
        }
      }

      const title = movie.title;
      delete Movies.free_movie[movieID];
      saveData(MoviesPath, Movies);

      ctx.reply(
        `🗑️ Kino/Serial *${title}* (ID: ${movieID}) Dagi o'chirib tashlandi.`,
        {
          parse_mode: "Markdown",
        },
      );
    } else if (
      ctx.session.operation === "add_movie_parts" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "Premium ⭐️") {
        ctx.session.operation = "off";
        ctx.session.channelType = "add_parts_premium";
        await ctx.reply(
          "Iltimos Kino kodini kiritnd, qaysi koddagi kinoga qo'shimcha kino qo'shmoqchisz: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Free 🆓") {
        ctx.session.operation = "off";
        ctx.session.channelType = "add_parts_free";
        await ctx.reply(
          "Iltimos Kino kodini kiritnd, qaysi koddagi kinoga qo'shimcha kino qo'shmoqchisz: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Iltimos, faqat sizga berilgan tugamalardan foydalaning!",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
    } else if (
      ctx.session.operation === "add_free_movie" &&
      isAdminOrOwner(userID)
    ) {
      if (channels.freeChannel === null) {
        return ctx.reply("Kechirasiz Free kanal mavjud emas ❌");
      }
      const state = ctx.session?.state;
      if (state === "awaiting_title") {
        ctx.session.movie = { title: ctx.message.text };
        ctx.session.state = "awaiting_description";
        ctx.reply("📝 Kino/Serial haqida qisqacha malumot bereng:");
      } else if (state === "awaiting_description") {
        ctx.session.movie.description = ctx.message.text;
        ctx.session.state = "awaiting_count";
        ctx.reply("🔢 Bu kino/serial qancha qisimdan iborat: ");
      } else if (state === "awaiting_count") {
        const count = parseInt(ctx.message.text);
        if (isNaN(count) || count <= 0) {
          return ctx.reply("❌ Iltimos, raqamlar kiriting.");
        }

        ctx.session.movie.count = count;
        ctx.session.operation = "off";
        ctx.session.movie.parts = [];
        ctx.session.state = "awaiting_uploads";
        ctx.session.type = "free";
        ctx.reply(
          `📤 Iltimos, ${count} shuncha kino/serial jo'nating (videoda izoh bo'lishi bu sizning tanlovingiz): `,
        );
      } else {
        console.log("Free Kino Qo'shishda xatolik mavjud");
      }
    } else if (
      ctx.session.operation === "add_admin" &&
      isAdminOrOwner(userID)
    ) {
      const admin_type = isAdminOrOwner(userID);
      if (admin_type === "admin") {
        return ctx.reply(
          "Sizda admin qo'shish huquqi mavjud emas 🔴",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
      }
      const adminID = parseInt(lastMessage);
      if (isNaN(adminID)) {
        return ctx.reply(
          "Foydalnuvchi IDisi raqamli malumot bo'ladi 🔴\n\nMisol uchun: 6097947786",
        );
      }
      if (
        admins.admins.includes(adminID) ||
        admins.super_admins.includes(adminID) ||
        adminID == OWNER
      ) {
        return ctx.reply("Kechirasiz bu foydalanuvchi allqachon admin 🔴");
      }

      if (ctx.session.admin_type === "super_admin" && userID === OWNER) {
        admins.super_admins.push(adminID);
        saveData(adminsPath, admins);
        try {
          await ctx.telegram.sendMessage(
            adminID,
            "Tabreklaymiz siz botimizda Super Admin etib tayinlandingiz 📈 /start",
            {
              parse_mode: "HTML",
              reply_markup: Markup.keyboard(ControlPanel(userID))
                .oneTime()
                .resize(),
            },
          );
        } catch (error) {
          console.log(error);
        }
        await ctx.reply(
          "Admin muvofaqiyatli saqlandi 🔵",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (ctx.session.admin_type === "admin") {
        admins.admins.push(adminID);
        saveData(adminsPath, admins);
        try {
          await ctx.telegram.sendMessage(
            adminID,
            "Tabreklaymiz siz botimizda Admin etib tayinlandingiz 📈 /start",
            {
              parse_mode: "HTML",
              reply_markup: Markup.keyboard(ControlPanel(userID))
                .oneTime()
                .resize(),
            },
          );
        } catch (error) {
          console.log(error);
        }
        await ctx.reply(
          "Admin muvofaqiyatli saqlandi 🔵",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        await ctx.reply(
          "Admin turini aniqlay olmadim",
          Markup.keyboard(ControlPanel).oneTime().resize(),
        );
        ctx.session.operation = "off";
        ctx.session.admin_type = "off";
        await ctx.reply("Amalyot bekor qilindi 🔵");
      }
    } else if (
      ctx.session.operation === "add_group" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "👥 Ommaviy") {
        ctx.session.groupType = "public";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos guruhni usernameni kiriting (Misol: @username): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        ctx.session.groupType = "private";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos guruhni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        ctx.session.groupType = "zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos guruhni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        ctx.session.groupType = "public_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos kanalni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Kechirasiz bu buyruq mavjud emas, yoki bot yangilangan! \n/start",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.operation = "off";
      }
    } else if (
      ctx.session.operation === "remove_admin" &&
      isAdminOrOwner(userID)
    ) {
      const admin_type = isAdminOrOwner(userID);
      if (admin_type === "admin") {
        return ctx.reply(
          "Sizda admin olish huquqi mavjud emas 🔴",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
      }
      const adminID = parseInt(lastMessage);
      if (isNaN(adminID)) {
        return ctx.reply(
          "Foydalnuvchi IDisi raqamli malumot bo'ladi 🔴\n\nMisol uchun: 6097947786",
        );
      }
      if (
        !admins.admins.includes(adminID) &&
        !admins.super_admins.includes(adminID) &&
        adminID !== OWNER
      ) {
        return ctx.reply("Kechirasiz bu foydalanuvchi admin emas 🔴");
      }
      if (ctx.session.admin_type === "super_admin" && userID === OWNER) {
        admins.super_admins = removeObject(admins.super_admins, adminID);
        saveData(adminsPath, admins);
        try {
          await ctx.telegram.sendMessage(
            adminID,
            "Afsuski siz botimizda Adminlikdan olib tashlandingiz 📉 /start",
          );
        } catch (error) {
          console.log(error);
        }
        await ctx.reply(
          "Admin muvofaqiyatli olib tashlandi 🔵",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (ctx.session.admin_type === "admin") {
        admins.admins = removeObject(admins.admins, adminID);
        saveData(adminsPath, admins);
        try {
          await ctx.telegram.sendMessage(
            adminID,
            "Afsuski siz botimizda Adminlikdan olib tashlandingiz 📉 /start",
          );
        } catch (error) {
          console.log(error);
        }
        await ctx.reply(
          "Admin muvofaqiyatli olib tashlandi 🔵",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        await ctx.reply(
          "Admin turini aniqlay olmadim",
          Markup.keyboard(ControlPanel).oneTime().resize(),
        );
        ctx.session.operation = "off";
        ctx.session.admin_type = "off";
        await ctx.reply("Amalyot bekor qilindi 🔵");
      }
    } else if (
      ctx.session.operation === "add_premium" &&
      isAdminOrOwner(userID)
    ) {
      const targetUserID = parseInt(lastMessage);
      const premiumUser = findsomething(usersData, "userID", targetUserID);
      if (isNaN(targetUserID)) {
        return ctx.reply(
          "Kechirasiz, foydalanuvchi IDisi har doim raqamli malumot bo'ladi 🔴",
        );
      }
      if (premiumUser === null) {
        return ctx.reply("Kechirasiz foydalanuvchi topilmadi 🔴");
      }
      if (isSubscriptionActive(targetUserID)) {
        return ctx.reply("Bu foydalanuvchida premium mavjud 🔴");
      } else {
        await activateSubscription(targetUserID);
        try {
          await ctx.telegram.sendMessage(
            targetUserID,
            `Bizning botimizning Premium hizmatini sotib olganizning uchun tashakur!\n\n🗓Premium Sotib olingan sana: ${usersData[premiumUser].subscription_date}\n\n📆Premium Tugash Mudati: ${usersData[premiumUser].expiration_date}`,
          );
        } catch (error) {
          console.log(error);
        }
        await ctx.reply("Foydalanuvchi uchun premium aktivlashtirildi 🟢");
      }
    } else if (
      ctx.session.operation === "add_channel" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "👥 Ommaviy") {
        ctx.session.channelType = "public";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos kanalni usernameni kiriting (Misol: @username): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        ctx.session.channelType = "private";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos kanalni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        ctx.session.channelType = "zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos kanalni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        ctx.session.channelType = "public_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos kanalni linki va IDisni kiriting (Misol: https://t.me/+UuGIOVWM6fowYmZi -1002241390864): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Kechirasiz bu buyruq mavjud emas, yoki bot yangilangan! \n/start",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.operation = "off";
      }
    } else if (
      ctx.session.operation === "add_base_channel" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "Premium ⭐️") {
        ctx.session.operation = "off";
        ctx.session.channelType = "premium_channel";
        ctx.reply(
          "Kiritmoqchi bo'lgan kanalingizni IDisini kiriting: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "Free 🆓") {
        ctx.session.operation = "off";
        ctx.session.channelType = "free_channel";
        ctx.reply(
          "Kiritmoqchi bo'lgan kanalingizni IDisini kiriting: ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Faqat sizga berilgan tugmalardan foydalaning ❌",
          Markup.keyboard([["Premium ⭐️", "Free 🆓"], ["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      }
    } else if (
      ctx.session.operation === "rm_channel" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "👥 Ommaviy") {
        ctx.session.channelType = "rm_public";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, kanalni o'chirish uchun uni usernameni kiriting (Misol: @username): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        ctx.session.channelType = "rm_private";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, shaxsiy kanalni o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        ctx.session.channelType = "rm_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, Zayafkani o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        ctx.session.channelType = "rm_public_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, Ommaviy zayafkani o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else {
        ctx.reply(
          "Kechirasiz bu buyruq mavjud emas, yoki bot yangilangan! \n/start",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.operation = "off";
      }
    } else if (ctx.session.operation === "rm_group" && isAdminOrOwner(userID)) {
      if (lastMessage === "👥 Ommaviy") {
        ctx.session.groupType = "rm_public";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, guruhni o'chirish uchun uni usernameni kiriting (Misol: @username): ",
          Markup.keyboard([["Bekor Qilish 🔙"]])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        ctx.session.groupType = "rm_private";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, shaxsiy guruhni o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        ctx.session.groupType = "rm_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, Zayafkani o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        ctx.session.groupType = "rm_public_zayafka";
        ctx.session.operation = "off";
        await ctx.reply(
          "Iltimos, Ommaviy zayafkani o'chirish uchun, uni IDisidan foydalaning (Misol: -1002241390864): ",
          Markup.keyboard(["Bekor Qilish 🔙"]).oneTime().resize(),
        );
      } else {
        ctx.reply(
          "Kechirasiz bu buyruq mavjud emas, yoki bot yangilangan! \n/start",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.operation = "off";
      }
    } else if (
      ctx.session.operation === "show_group" &&
      isAdminOrOwner(userID)
    ) {
      if (lastMessage === "👥 Ommaviy") {
        const groupsList = groups.public.length
          ? groups.public.join("\n")
          : "Kanallar mavjud emas 🔴";
        await ctx.reply(
          `Sizning Kanallaringiz:\n${groupsList}`,
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        let output = Object.entries(groups.private)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        let output = Object.entries(groups.zayafka)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        let output = Object.entries(groups.public_zayafka)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Xato buyruqni kiritdingiz, yoki botga to'g'ridan to'g'ri xabar yubordingiz. Buni tasodif deb qabul qilamiz!",
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      }
    } else if (
      ctx.session.operation === "add_premium_group_to_buy" &&
      isAdminOrOwner(userID)
    ) {
      try {
        const member = await bot.telegram.getChatMember(
          lastMessage,
          ctx.botInfo.id,
        );
        if (
          member.status === "member" ||
          member.status === "administrator" ||
          member.status === "creator"
        ) {
          premium_group_to_buy = lastMessage;
          ctx.reply(
            "Guruh joylandi",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
          ctx.session.operation = "off";
        } else {
          ctx.reply("Kechirasiz men bu guruhda azo emasman!");
        }
      } catch (error) {
        console.log(error);
        ctx.reply(
          "Tekshirishda xatolik mavjud iltimos, meni bu guruhda azo ekanligimga ishonch hosil qiling!",
        );
      }
    } else if (ctx.session.operation === "show_channel") {
      if (lastMessage === "👥 Ommaviy") {
        const channelList = channels.public.length
          ? channels.public.join("\n")
          : "Kanallar mavjud emas 🔴";
        await ctx.reply(
          `Sizning Guruhlaringiz:\n${channelList}`,
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "🔒 Shaxsiy") {
        let output = Object.entries(channels.private)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "⛓️ Zayafka") {
        let output = Object.entries(channels.zayafka)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else if (lastMessage === "👥 Ommaviy zayafka") {
        let output = Object.entries(channels.public_zayafka)
          .map(
            ([chatId, link]) =>
              `Chat ID: \`${chatId}\`, Link: ${link.replace(/([_\*\[\]\(\)~`>\#\+\-=|{}\.!])/g, "\\$1")}`,
          )
          .join("\n");

        if (!output) {
          return ctx.reply(
            "Sizda linklar mavjud emas ❌",
            Markup.keyboard([
              ["👥 Ommaviy", "🔒 Shaxsiy"],
              ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
              ["Bekor Qilish 🔙"],
            ])
              .oneTime()
              .resize(),
          );
        }

        return ctx.reply(
          output,
          { parse_mode: "MarkdownV2" },
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      } else {
        ctx.reply(
          "Xato buyruqni kiritdingiz, yoki botga to'g'ridan to'g'ri xabar yubordingiz. Buni tasodif deb qabul qilamiz!",
          Markup.keyboard([
            ["👥 Ommaviy", "🔒 Shaxsiy"],
            ["⛓️ Zayafka", "👥 Ommaviy zayafka"],
            ["Bekor Qilish 🔙"],
          ])
            .oneTime()
            .resize(),
        );
      }
    } else if (ctx.session.channelType) {
      const channelType = ctx.session.channelType;
      if (channelType === "public") {
        if (channels.public.includes(lastMessage)) {
          return ctx.reply(
            "Kechirasiz bu kanal ro'yxatda mavjud, boshqa kanalni qo'shib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        try {
          const member = await ctx.telegram.getChatMember(
            lastMessage,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            channels.public.push(lastMessage);
            saveData(channelsPath, channels);
            ctx.reply(
              "Kanal muvfaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu kanalda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "private") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in channels.private) {
          return await ctx.reply("Bu kanal allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            channels.private[chat_id] = link;
            await saveData(channelsPath, channels);
            await ctx.reply(
              "Kanal muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu kanalda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "zayafka") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in channels.zayafka) {
          return await ctx.reply("Bu kanal allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            channels.zayafka[chat_id] = link;
            await saveData(channelsPath, channels);
            await ctx.reply(
              "Kanal muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu kanalda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "public_zayafka") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in channels.public_zayafka) {
          return await ctx.reply("Bu kanal allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            channels.public_zayafka[chat_id] = link;
            await saveData(channelsPath, channels);
            await ctx.reply(
              "Kanal muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu kanalda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "rm_public") {
        if (!channels.public.includes(lastMessage)) {
          return ctx.reply("Kechirasiz, bu kanal ro'yxatda mavjud emas 🔴");
        }
        try {
          const index = channels.public.indexOf(lastMessage);
          channels.public.splice(index, 1);
          saveData(channelsPath, channels);
          await ctx.reply(
            "Kanal muvofaqiyatli o'chirildi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "rm_private") {
        if (!(lastMessage in channels.private)) {
          return ctx.reply(
            "Bu ID bilan hech qande kanal ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete channels.private[lastMessage];
          saveData(channelsPath, channels);
          ctx.reply(
            "Kanal muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "rm_zayafka") {
        if (!(lastMessage in channels.zayafka)) {
          return ctx.reply(
            "Bu ID bilan hech qande kanal ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete channels.zayafka[lastMessage];
          saveData(channelsPath, channels);
          ctx.reply(
            "Kanal muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "rm_public_zayafka") {
        if (!(lastMessage in channels.public_zayafka)) {
          return ctx.reply(
            "Bu ID bilan hech qande kanal ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete channels.public_zayafka[lastMessage];
          saveData(channelsPath, channels);
          ctx.reply(
            "Kanal muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (channelType === "premium_channel") {
        if (MoviesChannel.premiumChannel === null) {
          try {
            const member = await ctx.telegram.getChatMember(
              lastMessage,
              ctx.botInfo.id,
            );
            if (member.status === "administrator") {
              MoviesChannel.premiumChannel = lastMessage;
              saveData(MoviesChannelPath, MoviesChannel);
              ctx.reply(
                "Kanal botga muvfaqiyatli ulandi, tabreklaymiz 🎉",
                Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
              );
              ctx.session.channelType = null;
            }
          } catch (error) {
            console.log(error);
            ctx.reply(
              "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } else {
          ctx.reply(
            "Kechirasiz, siz kanal ulagansiz, birinchi u kanalni o'chiring ⚠️",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
          ctx.session.channelType = null;
        }
      } else if (channelType === "free_channel") {
        if (MoviesChannel.freeChannel === null) {
          try {
            const member = await ctx.telegram.getChatMember(
              lastMessage,
              ctx.botInfo.id,
            );
            if (member.status === "administrator") {
              MoviesChannel.freeChannel = lastMessage;
              saveData(MoviesChannelPath, MoviesChannel);
              ctx.reply(
                "Kanal botga muvfaqiyatli ulandi, tabreklaymiz 🎉",
                Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
              );
              ctx.session.channelType = null;
            }
          } catch (error) {
            console.log(error);
            ctx.reply(
              "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } else {
          ctx.reply(
            "Kechirasiz, siz kanal ulagansiz, birinchi u kanalni o'chiring ⚠️",
            Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
          );
          ctx.session.channelType = null;
        }
      } else if (channelType === "add_parts_premium") {
        const movieID = parseInt(lastMessage);
        if (isNaN(movieID)) {
          return ctx.reply(
            "🤔Men hamma kinolarni kodini faqat raqamlarda yaratganimni eslay olaman\n\n😐Siz uchun yana eslatma, kino kodlari raqamlardan tashkil topgan",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (!Movies.premium_movie[movieID]) {
          return ctx.reply(
            "Kechirasiz, siz kiritgan IDda kino mavjud emas ⚠️",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        ctx.session.state = "adding_parts";
        ctx.session.edit_uid = movieID;
        ctx.session.new_parts = [];
        ctx.session.type = "premium";
        ctx.reply(
          `🎞 Iltimos yangi qisimlarni yukleng *${Movies.premium_movie[movieID].title}* (ID: ${movieID}) uchun: `,
          {
            parse_mode: "Markdown",
          },
        );
      } else if (channelType === "add_parts_free") {
        const movieID = parseInt(lastMessage);
        if (isNaN(movieID)) {
          return ctx.reply(
            "🤔Men hamma kinolarni kodini faqat raqamlarda yaratganimni eslay olaman\n\n😐Siz uchun yana eslatma, kino kodlari raqamlardan tashkil topgan",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (!Movies.free_movie[movieID]) {
          return ctx.reply(
            "Kechirasiz, siz kiritgan IDda kino mavjud emas ⚠️",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        ctx.session.state = "adding_parts";
        ctx.session.edit_uid = movieID;
        ctx.session.new_parts = [];
        ctx.session.type = "free";
        ctx.reply(
          `🎞 Iltimos yangi qisimlarni yukleng *${Movies.free_movie[movieID].title}* (ID: ${movieID}) uchun: `,
          {
            parse_mode: "Markdown",
          },
        );
      } else {
        ctx.reply(
          "Bu bo'lishi mumkin emas!",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.channelType = null;
      }
    } else if (ctx.session.groupType) {
      const groupType = ctx.session.groupType;
      if (groupType === "public") {
        if (groups.public.includes(lastMessage)) {
          return ctx.reply(
            "Kechirasiz bu guruh ro'yxatda mavjud, boshqa kanalni qo'shib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        try {
          const member = await ctx.telegram.getChatMember(
            lastMessage,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            groups.public.push(lastMessage);
            saveData(groupsPath, groups);
            ctx.reply(
              "Guruh muvfaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu guruhda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Guruh qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu kanalda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "private") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in groups.private) {
          return await ctx.reply("Bu guruh allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            groups.private[chat_id] = link;
            await saveData(groupsPath, groups);
            await ctx.reply(
              "Guruh muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu guruhda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Guruh qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu guruhda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "zayafka") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in groups.zayafka) {
          return await ctx.reply("Bu guruh allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            groups.zayafka[chat_id] = link;
            await saveData(groupsPath, groups);
            await ctx.reply(
              "Guruh muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu guruhda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu guruhda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "public_zayafka") {
        const messageParts = lastMessage.split(" ");
        const chat_id = messageParts[1];
        const link = messageParts[0];
        if (!chat_id || !link) {
          return ctx.reply(
            "Siz xato kirityabsiz, shundey kirityotganingizga ishonch hosil qiling: \nMisol uchun: https://t.me/+UuGIOVWM6fowYmZi -1002241390864",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
        if (chat_id in groups.public_zayafka) {
          return await ctx.reply("Bu guruh allqachon qo'shilgan 🔴");
        }
        try {
          const member = await ctx.telegram.getChatMember(
            chat_id,
            ctx.botInfo.id,
          );
          if (member.status === "administrator") {
            groups.public_zayafka[chat_id] = link;
            await saveData(groupsPath, groups);
            await ctx.reply(
              "Guruh muvofaqiyatli qo'shildi: ",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          } else {
            return ctx.reply(
              "Kechirasiz, men birinchi bu guruhda admin bo'lishim kerak 🔴",
              Markup.keyboard([["Bekor Qilish 🔙"]])
                .oneTime()
                .resize(),
            );
          }
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Guruh qo'shishda xatolik yuz berdi, iltimos qaytadan tekshirib ko'ring. Men bu guruhda azomanmi?",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "rm_public") {
        if (!groups.public.includes(lastMessage)) {
          return ctx.reply("Kechirasiz, bu guruh ro'yxatda mavjud emas 🔴");
        }
        try {
          const index = groups.public.indexOf(lastMessage);
          groups.public.splice(index, 1);
          saveData(groupsPath, groups);
          await ctx.reply(
            "Guruh muvofaqiyatli o'chirildi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "rm_private") {
        if (!(lastMessage in groups.private)) {
          return ctx.reply(
            "Bu ID bilan hech qande kanal ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete groups.private[lastMessage];
          saveData(groupsPath, groups);
          ctx.reply(
            "Kanal muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "rm_zayafka") {
        if (!(lastMessage in groups.zayafka)) {
          return ctx.reply(
            "Bu ID bilan hech qande kanal ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete groups.zayafka[lastMessage];
          saveData(groupsPath, groups);
          ctx.reply(
            "Kanal muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Kanal o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else if (groupType === "rm_public_zayafka") {
        if (!(lastMessage in groups.public_zayafka)) {
          return ctx.reply(
            "Bu ID bilan hech qande guruh ro'yxatdan o'tmagan 🔴",
          );
        }
        try {
          delete groups.public_zayafka[lastMessage];
          saveData(groupsPath, groups);
          ctx.reply(
            "Guruh muvfaqiyatli o'chirib tashlandi: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        } catch (error) {
          console.log(error);
          ctx.reply(
            "Guruh o'chirishda xatolik yuz berdi, iltimos keyinroq urinib ko'ring: ",
            Markup.keyboard([["Bekor Qilish 🔙"]])
              .oneTime()
              .resize(),
          );
        }
      } else {
        ctx.reply(
          "Bu bo'lishi mumkin emas!",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
        ctx.session.groupType = null;
      }
    } else {
      if (isAdminOrOwner(userID)) {
        ctx.reply(
          "Kechirasiz bu buyuqni taney olmadim, bot yangilangan bo'lishi mumkin /start",
          Markup.keyboard(ControlPanel(userID)).oneTime().resize(),
        );
      } else {
        ctx.reply(
          "Kechirasiz bu buyuqni taney olmadim, bot yangilangan bo'lishi mumkin /start",
          Markup.removeKeyboard(),
        );
      }
    }
  } catch (error) {
    console.log(error);
    ctx.reply(
      `Xatolik mavjud dasturchingiz bilan bog'laning\n\nXatolik: ${error.message}`,
    );
  }
});

// Launch the bot only once

bot.launch((error) => {
  if (error) {
    console.log(error);
  }
  console.log("🚀 Bot is running!");
  console.log("Press Ctrl+C to stop the bot");
});

// Enable graceful stop
process.once("SIGINT", () => {
  console.log("\n👋 Stopping bot...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("\n👋 Stopping bot...");
  bot.stop("SIGTERM");
});
