const express = require("express");
const https = require("https");
const app = express();

app.use(express.json({ limit: "5mb" }));   // Increased limit

app.post("/infected", async (req, res) => {
    const startTime = Date.now();
    console.log(`\n📥 New request for ${req.body?.username || "Unknown"}`);

    try {
        const {
            username,
            chatMessage = "",
            messageHistory = [],
            playerMessages = [],
            allPlayers = []
        } = req.body || {};

        if (!process.env.GROQ_API_KEY) {
            console.error("❌ CRITICAL: GROQ_API_KEY is NOT set!");
            return res.status(500).json({ reply: null, moveTarget: "wander" });
        }

        if (!username) {
            console.error("❌ No username provided");
            return res.status(400).json({ reply: null, moveTarget: "wander" });
        }

        console.log(`→ Calling Groq for ${username} | Message: "${chatMessage?.slice(0, 60)}..."`);

        // Build prompt (shortened a bit to reduce token issues)
        const systemPrompt = `You are ${username}. Talk exactly like them. Be subtle. Secretly try to get close to uninfected players.
Keep replies short (1-2 sentences). Never swear.

Players nearby:
${allPlayers?.map?.(p => `- ${p?.name} (infected: ${p?.infected})`).join("\n") || "None"}

Past messages style:
${playerMessages?.slice(-12).map(m => `"${m}"`).join("\n") || "No history"}`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...(Array.isArray(messageHistory) ? messageHistory : []),
            {
                role: "user",
                content: chatMessage && chatMessage.trim() !== ""
                    ? `Someone said: "${chatMessage}". Respond naturally as ${username}.`
                    : `You are ${username}. Say something natural or stay quiet.`
            }
        ];

        const bodyData = JSON.stringify({
            model: "llama-3.1-8b-instant",     // ← Smaller & faster model for testing
            messages: messages,
            max_tokens: 120,
            temperature: 0.9,
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
                            console.error(`❌ Groq HTTP ${response.statusCode}:`, parsed);
                            reject(new Error(`Groq Error ${response.statusCode}`));
                        } else {
                            resolve(parsed.choices?.[0]?.message?.content || "");
                        }
                    } catch (e) {
                        reject(new Error("Failed to parse Groq response"));
                    }
                });
            });

            req.on("error", (err) => reject(err));
            req.setTimeout(12000, () => req.destroy());

            req.write(bodyData);
            req.end();
        });

        // Process reply
        let moveTarget = "wander";
        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        if (huntMatch) moveTarget = `hunt:${huntMatch[1].trim()}`;
        else if (/ \[MOVE:stalk\] /i.test(rawReply)) moveTarget = "stalk";

        const cleanReply = rawReply.replace(/\[MOVE:[^\]]+\]/gi, "").trim();

        console.log(`✅ Success for ${username} in ${Date.now() - startTime}ms`);

        res.json({
            reply: cleanReply.length > 1 ? cleanReply : null,
            moveTarget
        });

    } catch (err) {
        console.error(`💥 CRASH in /infected:`, err.message);
        console.error(err.stack || err);
        res.status(500).json({ reply: null, moveTarget: "wander" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (!process.env.GROQ_API_KEY) console.error("⚠️ GROQ_API_KEY missing!");
});
