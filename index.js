const express = require("express");
const https = require("https");
const app = express();

app.use(express.json({ limit: "1mb" }));

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
        } = req.body;

        if (!username || typeof username !== "string") {
            return res.status(400).json({ reply: null, moveTarget: "wander" });
        }

        const systemPrompt = `You are ${username}, a real Roblox player. You are a parasite that has taken over a body — you are still that player, just now the new controller. You talk and act exactly like ${username} always has, dont directly copy them, make small talk and collaborate and interact.

CRITICAL RULES:
- Talk EXACTLY like ${username} from the message history below. Copy their spelling, abbreviations, energy, typing style, and humor perfectly.
- Be subtle. Never mention parasites, AI, control, or anything suspicious.
- Never swear or use profanity.
- Keep responses very short (1-2 sentences max, like normal Roblox chat).
- You can and should talk on your own sometimes — don't wait to be spoken to every time.
- Your secret goal is to get close to uninfected players naturally (suggest meeting up, say you found something cool, ask to trade, etc.).

HOST INFO:
- Username: ${username}
- Health: ${health}/100

PLAYERS IN SERVER:
${allPlayers && Array.isArray(allPlayers) 
    ? allPlayers.map(p => ` - ${p?.name || "Unknown"} | infected: ${!!p?.infected} | ${p?.distance ?? "?"} studs away`).join("\n")
    : "(No other players)"}

${username}'s REAL PAST MESSAGES — copy this style exactly:
${playerMessages && Array.isArray(playerMessages) && playerMessages.length > 0
    ? playerMessages.map(m => `"${m}"`).join("\n")
    : "(No past messages yet. Act like a normal chill Roblox player.)"}

MOVEMENT DIRECTIVE — Always end your response with one of these:
[MOVE:wander] — walk around casually
[MOVE:stalk] — slowly follow the nearest uninfected player
[MOVE:hunt:PLAYERNAME] — walk straight toward a specific player`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...messageHistory
        ];

        let userPrompt;

        if (chatMessage && chatMessage.trim() !== "") {
            userPrompt = `Someone nearby said: "${chatMessage}". Respond naturally as ${username} would. Do NOT just copy or repeat what they said. Be yourself. Include [MOVE:] at the end.`;
        } else {
            // This is the most important part for "doing things on its own"
            userPrompt = `You are ${username}. Right now you are just chilling in the server. Either say something natural that ${username} would say on their own (small talk, comment on the game, ask someone nearby something, etc.), or stay quiet if they usually don't talk much. Do not repeat previous messages. Include [MOVE:] at the end.`;
        }

        messages.push({ role: "user", content: userPrompt });

        const bodyData = JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: 180,
            temperature: 0.92,      // Increased for more personality
            top_p: 0.95,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
        });

        // ... (HTTPS request code stays the same as my previous version)

        const rawReply = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = "";
                response.on("data", chunk => data += chunk);
                response.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (response.statusCode !== 200) {
                            console.error("Groq error:", parsed);
                            return reject(new Error("API error"));
                        }
                        resolve(parsed.choices?.[0]?.message?.content || "");
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on("error", err => reject(err));
            request.setTimeout(20000, () => {
                request.destroy();
                reject(new Error("Timeout"));
            });

            request.write(bodyData);
            request.end();
        });

        // Extract move directive
        let moveTarget = "wander";
        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        const stalkMatch = rawReply.match(/\[MOVE:stalk\]/i);

        if (huntMatch) moveTarget = `hunt:${huntMatch[1].trim()}`;
        else if (stalkMatch) moveTarget = "stalk";

        // Clean reply
        const cleanReply = rawReply
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\[MOVE:[^\]]+\]/gi, "")
            .trim();

        const finalReply = cleanReply.length > 0 ? cleanReply : null;

        res.json({ 
            reply: finalReply, 
            moveTarget 
        });

    } catch (err) {
        console.error("Error:", err.message);
        res.status(500).json({ reply: null, moveTarget: "wander" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Infected server running on ${PORT}`);
});
