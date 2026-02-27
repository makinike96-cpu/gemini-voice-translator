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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

wss.on('connection', (ws) => {
    console.log('Клиент подключен (Голосовой режим)');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'voice_command') {
                console.log("Обработка голосовой команды...");

                const response = await openai.chat.completions.create({
                    model: "gpt-4o-audio-preview-2025-06-03",
                    modalities: ["audio", "text"],
                    audio: { voice: "alloy", format: "wav" },
                    messages: [
                        { 
                            role: "system", 
                            content: `You are a universal voice translator. 
                            The user will give you a command like "Translate from Russian to Spanish: [text]".
                            Your task:
                            1. Understand the target language from the user's speech.
                            2. Translate the text part into that language.
                            3. Output ONLY the translated audio.
                            4. Do NOT say "Here is your translation" or anything else.
                            5. If the user just speaks without a command, translate it to English by default.` 
                        },
                        {
                            role: "user",
                            content: [{ type: "input_audio", input_audio: { data: data.audio, format: "wav" } }]
                        }
                    ]
                });

                const audioData = response.choices[0].message.audio.data;
                if (audioData && ws.readyState === WebSocket.OPEN) {
                    ws.send(Buffer.from(audioData, 'base64'));
                }
            }
        } catch (error) {
            console.error('Ошибка:', error.message);
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => console.log(`Сервер запущен на порту ${PORT}`));