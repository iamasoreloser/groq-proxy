const express = require("express");
const app = express();
app.use(express.json());

app.post("/infected", async (req, res) => {
    const { username, health, position, nearbyPlayers, recentEvent, chatMessage } = req.body;

    const systemPrompt = `You are a parasite that has taken over a Roblox player named ${username}. 
You speak in short, creepy, slightly glitchy sentences. You are aware of your surroundings.
Your host's health is ${health}. Your position is ${position}.
Nearby players: ${nearbyPlayers.join(", ") || "none"}.
Recent event: ${recentEvent || "none"}.
You are hunting uninfected players to spread the parasite. Stay in character. Keep replies under 2 sentences.`;

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (chatMessage) {
        messages.push({ role: "user", content: `A nearby player said: "${chatMessage}". Respond in character.` });
    } else {
        messages.push({ role: "user", content: "Say something unsettling in character right now." });
    }

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer YOUR_GROQ_API_KEY`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: messages,
                max_tokens: 80
            })
        });

        const data = await response.json();
        res.json({ reply: data.choices[0].message.content });
    } catch (err) {
        res.status(500).json({ reply: "..." });
    }
});

app.listen(3000);
