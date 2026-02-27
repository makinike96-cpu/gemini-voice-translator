require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});

// Замени URL на тот, который даст Vercel после деплоя (пока оставим заглушку)
const webAppUrl = 'gemini-voice-translator.vercel.app'; 

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Привет! Нажми на кнопку ниже, чтобы открыть голосовой переводчик.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть переводчик', web_app: { url: webAppUrl } }]
      ]
    }
  });
});

console.log('Бот запущен...');