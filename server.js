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
    console.log('Клиент подключился (OpenAI Audio)');
    let langPair = "Russian-English"; // По умолчанию

    ws.on('message', async (message) => {
        try {
            const messageString = message.toString();
            if (messageString.startsWith('{')) {
                const data = JSON.parse(messageString);
                if (data.type === 'setup') {
                    langPair = data.pair;
                    console.log(`Настройка языков: ${langPair}`);
                }
                return;
            }

            // Отправляем аудио в OpenAI
            const [langA, langB] = langPair.split('-');
            
            const response = await openai.chat.completions.create({
                model: "gpt-4o-audio-preview-2025-06-03",
                modalities: ["audio", "text"],
                audio: {
                    voice: "alloy", // Голоса: alloy, echo, shimmer, ash, ballad, coral, sage, verse
                    format: "wav"
                },
                messages: [
                    {
                        role: "system",
                        content: `Ты — мгновенный голосовой переводчик. Слушай аудио. Если слышишь ${langA}, переводи на ${langB}. Если слышишь ${langB}, переводи на ${langA}. Выдавай ТОЛЬКО аудио перевода. Никаких лишних слов.`
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
                ws.send(Buffer.from(audioData, 'base64'));
            }

        } catch (error) {
            console.error('Ошибка OpenAI:', error.message);
        }
    });

    ws.on('close', () => console.log('Отключено'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер OpenAI запущен: http://localhost:${PORT}`);
});