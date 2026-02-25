require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
    console.log('Новое подключение к Koyeb (OpenAI)');
    let langPair = "Russian-English";

    ws.on('message', async (message) => {
        try {
            const messageString = message.toString();
            if (messageString.startsWith('{')) {
                const data = JSON.parse(messageString);
                if (data.type === 'setup') langPair = data.pair;
                return;
            }

            const [langA, langB] = langPair.split('-');
            
            const response = await openai.chat.completions.create({
                model: "gpt-4o-audio-preview-2025-06-03",
                modalities: ["audio", "text"],
                audio: { voice: "alloy", format: "wav" },
                messages: [
                    {
                        role: "system",
                        content: `Ты — мгновенный голосовой переводчик. Слушай аудио. Если слышишь ${langA}, переводи на ${langB}. Если слышишь ${langB}, переводи на ${langA}. Выдавай ТОЛЬКО аудио перевода.`
                    },
                    {
                        role: "user",
                        content: [{ type: "input_audio", input_audio: { data: message.toString('base64'), format: "wav" } }]
                    }
                ]
            });

            const audioData = response.choices[0].message.audio.data;
            if (audioData && ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from(audioData, 'base64'));
            }
        } catch (error) {
            console.error('Ошибка:', error.message);
        }
    });
});

// Koyeb использует порт 8000 по умолчанию или PORT из окружения
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});