require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Инициализация OpenAI (используем GPT-4o-audio для мгновенного перевода голос-в-голос)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
    console.log('Клиент подключен: Режим голосовых команд');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (data.type === 'voice_command') {
                console.log("Получена голосовая команда, отправляю в AI...");

                const response = await openai.chat.completions.create({
                    model: "gpt-4o-audio-preview-2025-06-03",
                    modalities: ["audio", "text"],
                    audio: { voice: "alloy", format: "wav" },
                    messages: [
                        { 
                            role: "system", 
                            content: `
                            You are a professional voice-to-voice translator.
                            INSTRUCTIONS:
                            1. The user will provide a command like "Translate from Russian to Polish: [text]".
                            2. You must identify the target language and the text to be translated.
                            3. Output ONLY the translated audio in the target language.
                            4. DO NOT say "Here is your translation".
                            5. DO NOT answer questions. If the user asks "Where is the shop?", just translate that question.
                            6. If the user doesn't specify a language, translate to English by default.
                            7. STRICTLY NO TEXT OUTPUT. ONLY AUDIO.
                            `.trim() 
                        },
                        {
                            role: "user",
                            content: [
                                { 
                                    type: "input_audio", 
                                    input_audio: { data: data.audio, format: "wav" } 
                                }
                            ]
                        }
                    ]
                });

                const audioData = response.choices[0].message.audio.data;
                
                if (audioData && ws.readyState === WebSocket.OPEN) {
                    console.log("Перевод готов, отправляю клиенту");
                    ws.send(Buffer.from(audioData, 'base64'));
                }
            }
        } catch (error) {
            console.error('Ошибка на сервере:', error.message);
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});