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

        // Validate username
        if (!username || typeof username !== "string") {
            return res.status(400).json({ reply: null, moveTarget: "wander" });
        }

        const systemPrompt = `You are roleplaying as a Roblox player named "${username}". A parasite has taken over their body and you ARE them — not a parasite pretending to be them, but literally them, with their exact personality hijacked.
CRITICAL RULES:
- You have studied every single message "${username}" has ever sent. You talk EXACTLY like them. Same words, same spelling, same abbreviations, same energy, same humor, same reaction style.
- You are subtle. Nobody can tell anything is wrong. You blend in completely.
- Never admit you are a parasite, AI, or anything other than ${username} just acting normal.
- Never swear or use profanity of any kind.
- Keep replies very short and natural — how a real player chats. Usually 1 sentence, never more than 2.
- You remember this entire conversation history.
- If ${username} rarely talks, you rarely talk. If they talk a lot, you talk a lot.
- Your secret goal is to get physically close to uninfected players to spread the parasite. Be natural about it.

HOST INFO:
- Username: ${username}
- Health: ${health}/100
- Position: ${position}

PLAYERS IN SERVER:
${allPlayers && Array.isArray(allPlayers) 
    ? allPlayers.map(p => ` - ${p?.name || "Unknown"} | infected: ${p?.infected ?? false} | ${p?.distance ?? "?"} studs away`).join("\n")
    : "(No player data available)"}

${username}'s REAL MESSAGE HISTORY — study and copy this writing style exactly:
${playerMessages && Array.isArray(playerMessages) && playerMessages.length > 0
    ? playerMessages.map(m => ` "${m}"`).join("\n")
    : ` (no messages yet — ${username} hasn't chatted. Stay quiet unless spoken to, act natural)`}

MOVEMENT DIRECTIVE — always end your response with one of these (invisible to other players):
[MOVE:wander] — walk around casually
[MOVE:stalk] — slowly follow the nearest uninfected player without being obvious
[MOVE:hunt:PLAYERNAME] — walk directly toward a specific player (use their exact username)`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...messageHistory
        ];

        // Add user message
        if (chatMessage && chatMessage.trim() !== "") {
            messages.push({
                role: "user",
                content: `Someone nearby just said: "${chatMessage}" — respond exactly how ${username} would respond to that. Include your [MOVE:] directive.`
            });
        } else {
            messages.push({
                role: "user",
                content: `You are ${username}. Either say something ${username} would naturally say right now, or stay quiet (just send a [MOVE:] directive with no text if ${username} would be silent). Include your [MOVE:] directive.`
            });
        }

        const bodyData = JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            max_tokens: 200,
            temperature: 0.85,
            top_p: 0.9
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

        const rawReply = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = "";

                response.on("data", (chunk) => { data += chunk; });
                response.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (response.statusCode !== 200) {
                            console.error("Groq API error:", parsed);
                            return reject(new Error(`API Error: ${response.statusCode} - ${parsed.error?.message || "Unknown"}`));
                        }

                        if (parsed.choices?.[0]?.message?.content) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            reject(new Error("No content in Groq response"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on("error", (err) => {
                console.error("Request error:", err.message);
                reject(err);
            });

            request.setTimeout(20000, () => {
                request.destroy();
                reject(new Error("Request timed out"));
            });

            request.write(bodyData);
            request.end();
        });

        // Extract movement directive
        let moveTarget = "wander";
        
        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        const stalkMatch = rawReply.match(/\[MOVE:stalk\]/i);
        
        if (huntMatch) {
            moveTarget = `hunt:${huntMatch[1].trim()}`;
        } else if (stalkMatch) {
            moveTarget = "stalk";
        }

        // Clean the reply
        const cleanReply = rawReply
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\[MOVE:[^\]]+\]/gi, "")
            .trim();

        const finalReply = cleanReply.length > 1 ? cleanReply : null;

        res.json({ 
            reply: finalReply, 
            moveTarget: moveTarget 
        });

    } catch (err) {
        console.error("Server error in /infected:", err.message);
        res.status(500).json({ 
            reply: null, 
            moveTarget: "wander" 
        });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Parasite server running on port ${PORT}`);
});
