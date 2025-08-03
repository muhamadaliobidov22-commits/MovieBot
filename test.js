const { Telegraf, Markup } = require("telegraf")
require("dotenv").config();

const TOKEN = process.env.TOKEN;

const bot = new Telegraf(TOKEN);

const tempUsers = []
const tempUsersV2 = {}
bot.start((ctx) => {
    ctx.reply("Iltimos kontakt ulashing: ", Markup.keyboard([
        Markup.button.contactRequest("Telefon raqam 📞")
    ]).oneTime().resize());
})
bot.command("me", (ctx) => {
    const userID = ctx.from.id;
    const user = tempUsersV2[userID];
    if(!user){
        return ctx.reply("Kechirasiz siz aniqlanmadingiz, iltimos /start ni bosing va ro'yxatdan o'ting")
    }
    console.log(user.phone_number);
    ctx.reply("Rahmat")  
})
bot.on("contact", (ctx) => {
    const contact = ctx.message.contact
    tempUsers.push(contact)
    tempUsersV2[contact.user_id] = contact;
    console.log(tempUsersV2);
    
    console.log(tempUsers);
    ctx.reply("Rahmat")
})

bot.launch().then(console.log("Bot is running")).catch(console.log("Xatolik mavjud"))