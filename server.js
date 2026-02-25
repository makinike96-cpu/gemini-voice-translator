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
    console.log('Клиент подключен');
    let langPair = "Russian-English";

    ws.on('message', async (message) => {
        try {
            // Если пришел JSON (настройка)
            if (message.toString().startsWith('{')) {
                const data = JSON.parse(message.toString());
                if (data.type === 'setup') langPair = data.pair;
                return;
            }

            // Если пришло аудио (Buffer)
            console.log(`Получено аудио (${message.length} байт). Отправляю в OpenAI...`);
            const [langA, langB] = langPair.split('-');

            const response = await openai.chat.completions.create({
                model: "gpt-4o-audio-preview-2025-06-03",
                modalities: ["audio", "text"],
                audio: { voice: "alloy", format: "wav" },
                messages: [
                    {
                        role: "system",
                        content: `Ты — мгновенный голосовой переводчик. Если слышишь ${langA}, переводи на ${langB}. Если слышишь ${langB}, переводи на ${langA}. Выдавай ТОЛЬКО аудио перевода.`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_audio",
                                input_audio: {
                                    data: message.toString('base64'),
                                    format: "wav"
                                }
                            }
                        ]
                    }
                ]
            });

            const audioData = response.choices[0].message.audio.data;
            if (audioData && ws.readyState === WebSocket.OPEN) {
                console.log("Ответ от OpenAI получен, отправляю клиенту.");
                ws.send(Buffer.from(audioData, 'base64'));
            }
        } catch (error) {
            console.error('ОШИБКА:', error.message);
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});