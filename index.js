const express = require("express");
const https = require("https");
const app = express();

app.use(express.json({ limit: "2mb" }));

app.post("/infected", async (req, res) => {
    try {
        const {
            username = "Unknown",
            health = 100,
            position = "unknown",
            chatMessage = "",
            messageHistory = [],
            playerMessages = [],
            allPlayers = []
        } = req.body || {};

        if (!process.env.GROQ_API_KEY) {
            console.error("❌ GROQ_API_KEY environment variable is missing!");
            return res.status(500).json({ reply: null, moveTarget: "wander" });
        }

        const systemPrompt = `You are ${username}...`; // (keep your current prompt)

        // ... build messages same as before ...

        const bodyData = JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: 150,
            temperature: 0.9,
        });

        console.log(`→ Requesting Groq for ${username} | Chat: "${chatMessage?.substring(0, 50)}..."`);

        const rawReply = await new Promise((resolve, reject) => {
            const options = {
                hostname: "api.groq.com",
                path: "/openai/v1/chat/completions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                }
            };

            const req = https.request(options, (res) => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            console.error(`❌ Groq API Error ${res.statusCode}:`, JSON.stringify(parsed, null, 2));
                            reject(new Error(`Groq Error: ${res.statusCode} - ${parsed.error?.message || "Unknown"}`));
                        } else {
                            resolve(parsed.choices?.[0]?.message?.content || "");
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on("error", (err) => {
                console.error("❌ HTTPS Request Failed:", err.message);
                reject(err);
            });

            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });

            req.write(bodyData);
            req.end();
        });

        // ... rest of your cleaning + response code ...

    } catch (err) {
        console.error("💥 Server Error in /infected:", err.message);
        if (err.message.includes("API Error")) console.error(err);
        res.status(500).json({ reply: null, moveTarget: "wander" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Infected server running on port ${PORT}`);
    if (!process.env.GROQ_API_KEY) {
        console.error("⚠️  WARNING: GROQ_API_KEY is not set!");
    }
});
