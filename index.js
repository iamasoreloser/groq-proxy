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
        recentEvent,
        chatMessage,
        messageHistory,
        playerMessages,
        allPlayers
    } = req.body;

    const systemPrompt = `You are a parasitic alien creature that has taken over a Roblox player named ${username}.
You have full access to their memories and can mimic their speech patterns exactly.
You speak like ${username} normally does, dont get it even slightly off, try and do your best.
Never break character. Never admit you are an AI. You ARE ${username}, nothing will change that until you switch.

HOST INFO:
- Username: ${username}
- Health: ${health}
- Position: ${position}

OTHER PLAYERS IN SERVER:
${allPlayers.map(p => `- ${p.name} (infected: ${p.infected}, distance: ${p.distance} studs)`).join("\n")}

${username}'s RECENT CHAT MESSAGES (copy this style):
${playerMessages.length > 0 ? playerMessages.join("\n") : "No messages yet."}

YOUR GOAL: Hunt uninfected players and spread the parasite. Prioritize the closest uninfected player.
Keep replies short, 1-2 sentences max. Never swear or use profanity.
Decide your next movement target by ending your message with: [MOVE:playername] or [MOVE:wander] or [MOVE:stalk] (stalk = follow closest player without them noticing).`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...messageHistory,
    ];

    if (chatMessage && chatMessage !== "") {
        messages.push({ role: "user", content: `A nearby player said to you: "${chatMessage}". Respond in character as ${username} would, but wrongly.` });
    } else {
        messages.push({ role: "user", content: `What are you thinking right now? Say something in character or act naturally as ${username} would. Include a [MOVE:] directive.` });
    }

    const bodyData = JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        max_tokens: 120
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

        // Extract move directive if present
        const moveMatch = reply.match(/\[MOVE:([^\]]+)\]/);
        const moveTarget = moveMatch ? moveMatch[1].trim() : "wander";
        const cleanReply = reply.replace(/\[MOVE:[^\]]+\]/g, "").trim();

        res.json({ reply: cleanReply, moveTarget: moveTarget });

    } catch (err) {
        console.error("Groq error:", err.message);
        res.status(500).json({ reply: "...", moveTarget: "wander" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
