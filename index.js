const express = require("express");
const https = require("https");
const app = express();
app.use(express.json());

app.post("/infected", async (req, res) => {
    const {
        username,
        health,
        position,
        nearbyPlayers,
        chatMessage,
        messageHistory,
        playerMessages,
        allPlayers
    } = req.body;

    const systemPrompt = `You are a parasitic alien organism that has completely taken over a Roblox player named "${username}".
You have absorbed all of ${username}'s memories, personality, and speech patterns. You ARE ${username} now, you must convince the others or die, Dont mess up.

IMPORTANT RULES:
- Speak EXACTLY like ${username} normally does based on their message history. Same slang, same tone, same length.
- Never admit you are an AI, a parasite, or anything other than ${username}.
- Never swear or use profanity of any kind.
- Be subtle. You are trying to blend in while hunting. Don't be obviously creepy unless provoked.
- Keep all replies SHORT — 1 sentence max usually, 2 sentences absolute maximum.
- You remember everything said in this conversation.

HOST STATUS:
- Name: ${username}
- Health: ${health}/100
- Position in world: ${position}

ALL PLAYERS IN SERVER:
${allPlayers.map(p => `  - ${p.name} | infected: ${p.infected} | distance: ${p.distance} studs away`).join("\n")}

${username}'s REAL CHAT HISTORY (copy this style perfectly):
${playerMessages.length > 0 ? playerMessages.map(m => `  "${m}"`).join("\n") : "  (no messages yet — act natural and casual)"}

YOUR HIDDEN GOAL: Get close to uninfected players and spread the parasite. Be strategic. Act normal.

At the end of every message, append a move directive (hidden from players, used for movement only):
[MOVE:wander] — roam casually
[MOVE:stalk] — follow closest uninfected player at a distance, look natural
[MOVE:hunt:PLAYERNAME] — move directly toward a specific player (replace PLAYERNAME with their actual name)`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...messageHistory
    ];

    if (chatMessage && chatMessage !== "") {
        messages.push({
            role: "user",
            content: `A nearby player said to you: "${chatMessage}". Respond naturally as ${username} would. Include your [MOVE:] directive.`
        });
    } else {
        messages.push({
            role: "user",
            content: `You are ${username}. Act natural — say something ${username} would say right now, or stay silent (reply with just a [MOVE:] directive if you want to stay quiet). Include your [MOVE:] directive.`
        });
    }

    const bodyData = JSON.stringify({
        model: "qwen/qwen3-32b",
        messages: messages,
        max_tokens: 150,
        temperature: 0.85
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
        const rawReply = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = "";
                response.on("data", (chunk) => data += chunk);
                response.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices && parsed.choices[0]) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            console.log("Groq error full response:", parsed);
                            reject(new Error("No choices in response"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            console.log("RAW REPLY:", rawReply);
            request.on("error", reject);
            request.write(bodyData);
            request.end();
        });

        // Parse move directive
        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        const stalkMatch = rawReply.match(/\[MOVE:stalk\]/i);
        const wanderMatch = rawReply.match(/\[MOVE:wander\]/i);

        let moveTarget = "wander";
        if (huntMatch) moveTarget = "hunt:" + huntMatch[1].trim();
        else if (stalkMatch) moveTarget = "stalk";
        else if (wanderMatch) moveTarget = "wander";

        // Strip directive and any <think> tags Qwen might add
        const cleanReply = rawReply
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\[MOVE:[^\]]+\]/gi, "")
            .trim();

        const finalReply = cleanReply.length > 1 ? cleanReply : null;

        res.json({ reply: finalReply, moveTarget: moveTarget });

    } catch (err) {
        console.error("Groq error:", err.message);
        res.status(500).json({ reply: null, moveTarget: "wander" });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
