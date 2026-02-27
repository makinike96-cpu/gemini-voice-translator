require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    // ПРОВЕРКА: Выведем первые 5 символов ключа, чтобы убедиться, что он подгрузился
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ Ошибка: Ключ не найден в файле .env!");
        return;
    }
    console.log(`Ключ подгружен (начинается на: ${key.substring(0, 5)}...)`);

    const genAI = new GoogleGenerativeAI(key);
    
    // Используем именно ту модель, которую ты указал
    // Примечание: В API Google название модели обычно пишется так:
    const modelName = "gemini-2.0-flash-exp"; // Или "gemini-1.5-flash", так как 2.5 еще может быть в превью под другими именами
    
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log(`--- Проверка модели ${modelName} ---`);
    
    try {
        const result = await model.generateContent("Привет! Если ты это читаешь, значит API ключ работает. Ответь кратко.");
        const response = await result.response;
        console.log("Ответ от Gemini:", response.text());
        console.log("✅ Твой ключ и модель РАБОТАЮТ!");
    } catch (error) {
        console.error("❌ Ошибка:");
        console.error(error.message);
        console.log("\nСовет: Проверь, что в Google AI Studio у тебя создан API Key именно для этого проекта.");
    }
}

testGemini();