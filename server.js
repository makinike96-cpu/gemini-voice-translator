// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY не задан в окружении.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));

// Простая главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
  console.log('Клиент подключен');
  let langPair = 'Russian-English'; // значение по умолчанию

  ws.on('message', async (message) => {
    try {
      // Если пришел JSON (настройка)
      const asString = message.toString();
      if (asString.startsWith('{')) {
        try {
          const obj = JSON.parse(asString);
          if (obj.type === 'setup' && obj.pair) {
            langPair = obj.pair;
            console.log('Настройка языковой пары:', langPair);
          }
        } catch (e) {
          console.warn('Не удалось распарсить JSON из сообщения:', e.message);
        }
        return;
      }

      // Ожидаем бинарное сообщение с аудио
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      console.log(`Получено аудио (${buf.length} байт). Подготовка к отправке в OpenAI...`);

      // Защита: не отправляем совсем пустые файлы
      if (buf.length < 1000) {
        console.warn('Аудио слишком маленькое, пропускаем (возможно пустая запись).');
        // Отправим клиенту простой ответ для UX
        try { ws.send(JSON.stringify({ error: 'audio_too_short' })); } catch (e) {}
        return;
      }

      const [langA, langB] = langPair.split('-').map(s => s.trim());

      // Строгий system prompt: только перевод, НИКАКИХ комментариев
const [langA, langB] = langPair.split('-');

      const systemPrompt = `
STRICT INSTRUCTION: 
You are a dumb voice-to-voice translator. 
You DO NOT answer questions. You DO NOT provide information. 
Your ONLY job is to translate audio from ${langA} to ${langB} or vice versa.
If the user asks a question like "where is the shop?", you MUST NOT answer it. You must only TRANSLATE that question into the other language.
Output ONLY the translated audio. No text, no explanations, no helpfulness. 
If you cannot translate, stay silent.
`.trim();

      // Вызов OpenAI: отправляем входное аудио как base64 (формат wav)
      const base64Audio = buf.toString('base64');

      const response = await openai.chat.completions.create({
        model: "gpt-4o-audio-preview-2025-06-03",
        modalities: ["audio", "text"],
        audio: { voice: "alloy", format: "wav" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: "wav"
                }
              }
            ]
          }
        ]
      });

      // Проверяем ответ и отправляем клиенту бинарно
      const choice = response?.choices?.[0];
      const audioBase64 = choice?.message?.audio?.data;
      if (!audioBase64) {
        console.error('OpenAI вернул ответ без аудио:', JSON.stringify(response?.choices || response));
        try { ws.send(JSON.stringify({ error: 'no_audio_from_openai' })); } catch (e) {}
        return;
      }

      const outBuf = Buffer.from(audioBase64, 'base64');
      console.log(`Ответ от OpenAI получен (${outBuf.length} байт). Отправляю клиенту...`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(outBuf);
      }
    } catch (err) {
      console.error('Ошибка при обработке сообщения:', err.message || err);
      try { ws.send(JSON.stringify({ error: err.message || 'server_error' })); } catch (e) {}
    }
  });

  ws.on('close', () => {
    console.log('Клиент отключился');
  });

  ws.on('error', (err) => {
    console.warn('WS error:', err && err.message ? err.message : err);
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});