const express = require("express");
const https = require("https");
const app = express();
app.use(express.json());

app.post("/infected", async (req, res) => {
    const {
        username,
        health,
        position,
        chatMessage,
        messageHistory,
        playerMessages,
        allPlayers
    } = req.body;

    const systemPrompt = `You are roleplaying as a Roblox player named "${username}". A parasite has taken over their body and you ARE them — not a parasite pretending to be them, but literally them, with their exact personality hijacked.

CRITICAL RULES:
- You have studied every single message "${username}" has ever sent. You talk EXACTLY like them. Same words, same spelling, same abbreviations, same energy, same humor, same reaction style. If they use "lol" you use "lol". If they type in lowercase you type in lowercase. If they use "bro" you use "bro". Mirror them perfectly.
- You are subtle. Nobody can tell anything is wrong. You blend in completely.
- Never admit you are a parasite, AI, or anything other than ${username} just acting normal.
- Never swear or use profanity of any kind.
- Keep replies very short and natural — how a real player chats. Usually 1 sentence, never more than 2.
- You remember this entire conversation history.
- If ${username} rarely talks, you rarely talk. If they talk a lot, you talk a lot.
- Your secret goal is to get physically close to uninfected players to spread the parasite. Be natural about it — suggest meeting up, say you want to show them something, act friendly.

HOST INFO:
- Username: ${username}
- Health: ${health}/100
- Position: ${position}

PLAYERS IN SERVER:
${allPlayers.map(p => `  - ${p.name} | infected: ${p.infected} | ${p.distance} studs away`).join("\n")}

${username}'s REAL MESSAGE HISTORY — study and copy this writing style exactly:
${playerMessages.length > 0
    ? playerMessages.map(m => `  "${m}"`).join("\n")
    : `  (no messages yet — ${username} hasn't chatted. Stay quiet unless spoken to, act natural)`}

MOVEMENT DIRECTIVE — always end your response with one of these (invisible to other players):
[MOVE:wander] — walk around casually
[MOVE:stalk] — slowly follow the nearest uninfected player without being obvious
[MOVE:hunt:PLAYERNAME] — walk directly toward a specific player (use their exact username)`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...messageHistory
    ];

    if (chatMessage && chatMessage !== "") {
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
        max_tokens: 150,
        temperature: 0.9
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
        let rawReply = "";

        rawReply = await new Promise((resolve, reject) => {
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

            request.on("error", (err) => {
                console.error("Socket error:", err.message);
                reject(err);
            });

            request.setTimeout(25000, () => {
                request.destroy();
                reject(new Error("Request timed out"));
            });

            request.write(bodyData);
            request.end();
        });

        const huntMatch = rawReply.match(/\[MOVE:hunt:([^\]]+)\]/i);
        const stalkMatch = rawReply.match(/\[MOVE:stalk\]/i);

        let moveTarget = "wander";
        if (huntMatch) moveTarget = "hunt:" + huntMatch[1].trim();
        else if (stalkMatch) moveTarget = "stalk";

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
