const apiKey = "sk-"; // Вставь сюда свой ключ sk-...

async function checkModels() {
    console.log("Проверяем доступные модели OpenAI...");
    try {
        const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ Ошибка API:", data.error.message);
            return;
        }

        const models = data.data.map(m => m.id);
        const audioModel = "gpt-4o-audio-preview";
        
        const hasAudio = models.some(m => m.includes(audioModel));

        if (hasAudio) {
            console.log(`✅ УРА! Модель ${audioModel} ДОСТУПНА.`);
            console.log("Список похожих моделей в твоем аккаунте:", models.filter(m => m.includes("audio")));
        } else {
            console.log(`❌ Модель ${audioModel} НЕ НАЙДЕНА.`);
            console.log("Доступные тебе GPT-4 модели:", models.filter(m => m.includes("gpt-4")));
            console.log("\nСовет: Если баланс $0, пополни его на $5 на сайте OpenAI.");
        }
    } catch (error) {
        console.error("❌ Ошибка сети:", error.message);
    }
}

checkModels();