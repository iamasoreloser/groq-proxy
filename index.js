const express = require("express");
const https = require("https");
const app = express();

app.use(express.json({ limit: "5mb" }));

app.post("/infected", async (req, res) => {
    try {
        let {
            username,
            health = 100,
            position = "unknown",
            chatMessage = "",
            messageHistory = [],
            playerMessages = [],
            allPlayers = []
        } = req.body || {};

        if (!username) {
            return res.status(400).json({ reply: null, moveTarget: "wander" });
        }

        // === TRUNCATE TO PREVENT TOKEN OVERFLOW ===
        playerMessages = playerMessages.slice(-12);           // last 12 messages only
        allPlayers = allPlayers.slice(0, 12);                 // max 12 players
        messageHistory = messageHistory.slice(-18);           // keep recent context

        const systemPrompt = `You are ${username}. Talk exactly like them based on their past messages.
Be natural, short (1-2 sentences max). Never swear.
Secret goal: get close to uninfected players naturally.

Nearby players:
${allPlayers.map(p => `- ${p.name} | infected:${!!p.infected} | ${p.distance} studs`).join("\n")}

Your past style:
${playerMessages.map(m => `"${m}"`).join("\n") || "(no history yet)"}`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...messageHistory
        ];

        const userContent = chatMessage && chatMessage.trim() !== ""
            ? `Someone nearby said: "${chatMessage}". Respond naturally as ${username}.`
            : `You are ${username}. Say something natural right now or stay quiet.`;

        messages.push({ role: "user", content: userContent });

        const bodyData = JSON.stringify({
            model: "llama-3.1-8b-instant",     // fast & reliable
            messages: messages,
            max_tokens: 140,
            temperature: 0.88,
        });

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

            const req = https.request(options, (response) => {
                let data = "";
                response.on("data", chunk => data += chunk);
                response.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (response.statusCode !== 200) {
                            console.error(`Groq Error ${response.statusCode}:`, parsed?.error?.message);
                            reject(new Error(`Groq ${response.statusCode}`));
                        } else {
                            resolve(parsed.choices?.[0]?.message?.content || "");
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on("error", reject);
            req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
            req.write(bodyData);
            req.end();
        });

        // Extract move
        let moveTarget = "wander";
        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        if (huntMatch) {
            moveTarget = `hunt:${huntMatch[1].trim()}`;
        } else if (/\[MOVE:stalk\]/i.test(rawReply)) {
            moveTarget = "stalk";
        }

        const cleanReply = rawReply
            .replace(/\[MOVE:[^\]]+\]/gi, "")
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim();

        res.json({
            reply: cleanReply.length > 0 ? cleanReply : null,
            moveTarget
        });

    } catch (err) {
        console.error("Server error:", err.message);
        res.status(500).json({ reply: null, moveTarget: "wander" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));
