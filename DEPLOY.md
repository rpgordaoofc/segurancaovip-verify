# Deploy do Servidor de Verificação no Render.com

## Passo a passo:

### 1. Crie uma conta no Render.com
- Acesse: https://render.com
- Crie conta com GitHub ou email

### 2. Crie um novo Web Service
- Clique em "New" → "Web Service"
- Conecte este repositório

### 3. Configure:
- **Name:** segurancaovip
- **Runtime:** Node
- **Build Command:** npm install
- **Start Command:** node server.js
- **Instance Type:** Free

### 4. Adicione as variáveis de ambiente (Environment):
```
CLIENT_ID = (seu client id)
CLIENT_SECRET = (seu client secret)
REDIRECT_URI = https://segurancaovip.onrender.com/verify
BOT_TOKEN = (seu token do bot)
LOG_WEBHOOK = (webhook do canal de logs)
```

### 5. Após deploy, sua URL será:
```
https://segurancaovip.onrender.com
```

### 6. No Discord Developer Portal:
- OAuth2 → Redirects → Adicione:
```
https://segurancaovip.onrender.com/verify
```

### 7. No .env do bot (Discloud):
```
REDIRECT_URI=https://segurancaovip.onrender.com/verify
```

## Pronto! URL fixa, 24h online, sem mudar nunca.
