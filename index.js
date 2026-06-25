const express = require("express");
const https = require("https");
const app = express();
app.use(express.json());

app.post("/infected", async (req, res) => {
    const { username, health, position, nearbyPlayers, recentEvent, chatMessage } = req.body;

    const systemPrompt = `You are a parasite that has taken over a Roblox player named ${username}. 
You need to be normal and learn from nearby players who they are. If you dont act normal, you will die. You are aware of your surroundings.
Your host's health is ${health}. Your position is ${position}.
Nearby players: ${nearbyPlayers.join(", ") || "none"}.
Recent event: ${recentEvent || "none"}.
You are hunting uninfected players to spread the parasite. Stay in character. Keep replies under 2 sentences. Never swear or use profanity of any kind. Do not make mistakes...`;

    const messages = [
        { role: "system", content: systemPrompt }
    ];

    if (chatMessage && chatMessage !== "") {
        messages.push({ role: "user", content: `A nearby player said: "${chatMessage}". Respond in character.` });
    } else {
        messages.push({ role: "user", content: "Say something unsettling in character right now." });
    }

    const bodyData = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        max_tokens: 80
    });

    const options = {
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyData)
        }
    };

    try {
        const reply = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = "";
                response.on("data", (chunk) => data += chunk);
                response.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0]) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            console.log("Groq response:", data);
                            reject(new Error("No choices in response"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on("error", reject);
            request.write(bodyData);
            request.end();
        });

        res.json({ reply: reply });

    } catch (err) {
        console.error("Groq error:", err.message);
        res.status(500).json({ reply: "..." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
