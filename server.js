// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY не задан в .env");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

wss.on('connection', (ws) => {
  console.log('Клиент подключен');

  ws.on('message', async (message) => {
    try {
      // Ожидаем JSON-строку с полями: type:'audio_data', pair: 'LanguageA-LanguageB', audio: base64String
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (e) {
        console.warn('Получено не-JSON сообщение — игнорируем');
        return;
      }

      if (data.type !== 'audio_data') {
        // поддержка других типов сообщений при необходимости
        console.log('Неподдерживаемый тип сообщения:', data.type);
        return;
      }

      if (!data.pair || !data.audio) {
        console.warn('Неполные данные: нет pair или audio');
        try { ws.send(JSON.stringify({ error: 'invalid_payload' })); } catch {}
        return;
      }

      const pair = data.pair;
      const parts = pair.split('-').map(s => s.trim());
      if (parts.length !== 2) {
        console.warn('Неправильный формат пары языков:', pair);
        try { ws.send(JSON.stringify({ error: 'invalid_pair_format' })); } catch {}
        return;
      }
      const langA = parts[0];
      const langB = parts[1];

      // Проверим размер аудио (в base64). Пусть минимум ~1KB (примерно 0.75KB бинарных).
      const base64Audio = data.audio;
      if (base64Audio.length < 2000) {
        console.warn('Аудио слишком короткое, пропускаем (base64 length):', base64Audio.length);
        try { ws.send(JSON.stringify({ error: 'audio_too_short' })); } catch {}
        return;
      }

      console.log(`Запрос на перевод: ${langA} <-> ${langB}. Размер base64=${base64Audio.length}`);

      // СТРОГОЕ системное сообщение — запрет на любые комментарии/ответы кроме аудио-перевода
      const systemPrompt = `
STRICT INSTRUCTIONS FOR TRANSLATION ONLY:
You are a voice-to-voice translator for exactly two languages: ${langA} and ${langB}.
1) Detect which of the two languages the incoming audio is in.
2) If it is ${langA}, translate it to ${langB}. If it is ${langB}, translate it to ${langA}.
3) Output ONLY the spoken translation audio (WAV). Do NOT output any text, explanations, advice, questions, or additional words.
4) Do NOT attempt to answer user questions or perform actions. If the user asks e.g. "Where is a shop?", you MUST NOT provide directions — you MUST ONLY translate that question into the other language.
5) If you cannot confidently translate, produce silence (no speech).
6) Strictly output audio only (no text).`;

      // Вызов OpenAI — отправляем аудио как входное аудио в формате wav (base64)
      let response;
      try {
        response = await openai.chat.completions.create({
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
          ],
          // optional: задаём таймаут/параметры, если нужно
          // max_tokens: 750
        });
      } catch (err) {
        console.error('Ошибка запроса к OpenAI:', err && (err.message || err));
        try { ws.send(JSON.stringify({ error: 'openai_request_failed', message: err.message || String(err) })); } catch {}
        return;
      }

      // Извлекаем аудио из ответа
      const choice = response?.choices?.[0];
      const audioBase64 = choice?.message?.audio?.data;
      if (!audioBase64) {
        console.error('OpenAI вернул ответ без audio.data. Full response:', JSON.stringify(response, null, 2));
        try { ws.send(JSON.stringify({ error: 'no_audio_in_response' })); } catch {}
        return;
      }

      const outBuf = Buffer.from(audioBase64, 'base64');
      console.log(`Отправляю клиенту аудио размером ${outBuf.length} байт`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(outBuf);
      }
    } catch (err) {
      console.error('Ошибка обработки WS сообщения:', err && err.message ? err.message : err);
      try { ws.send(JSON.stringify({ error: 'server_error', message: err && err.message ? err.message : String(err) })); } catch {}
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
server.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));