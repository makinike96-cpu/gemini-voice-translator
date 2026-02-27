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
    // Храним выбранный язык прямо внутри объекта соединения
    ws.currentLangPair = "Russian-English"; 

    ws.on('message', async (message) => {
        try {
            const msgString = message.toString();
            
            // Если пришел JSON с настройкой языка
            if (msgString.startsWith('{')) {
                const data = JSON.parse(msgString);
                if (data.type === 'setup') {
                    ws.currentLangPair = data.pair;
                    console.log('Язык изменен на:', ws.currentLangPair);
                }
                return;
            }

            // Если пришло аудио
            const [langA, langB] = ws.currentLangPair.split('-');
            console.log(`Перевожу пару: ${langA} <-> ${langB}`);

            const systemPrompt = `
STRICT INSTRUCTION: 
You are a voice-to-voice translator. 
Your ONLY job is to translate audio from ${langA} to ${langB} or vice versa.
If the user asks a question, DO NOT answer it. Only TRANSLATE the question.
Output ONLY the translated audio. No explanations. 
If you cannot translate, stay silent.
`.trim();

            const response = await openai.chat.completions.create({
                model: "gpt-4o-audio-preview-2025-06-03",
                modalities: ["audio", "text"],
                audio: { voice: "alloy", format: "wav" },
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [{ 
                            type: "input_audio", 
                            input_audio: { data: message.toString('base64'), format: "wav" } 
                        }]
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

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});