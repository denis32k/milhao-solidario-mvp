# Milhão Solidário — versão seleção de área primeiro

Esta versão deixa a home como um grid em tela cheia e muda o fluxo do Mosaico Solidário para:

```txt
1. Escolher área no grid
2. Preencher nome, WhatsApp e CPF
3. Gerar PIX Mercado Pago
4. Webhook ou botão “Já paguei” confirma o pagamento
```

## Importante

Esta versão altera o `prisma/schema.prisma` e adiciona ao model `User`:

```txt
whatsapp
cpfHash
cpfLast4
```

Depois de subir esta versão, rode no terminal Sh do EasyPanel:

```bash
npx prisma generate
npx prisma db push
```

## Rotas principais

```txt
/
/checkout
/api/stats
/api/map/blocks
/api/mercado-pago-pix
/api/mercado-pago-pix/webhook
/api/admin/latest-transactions
/api/admin/release-expired-reservations
```

## Variáveis no EasyPanel

```txt
DATABASE_URL=postgresql://milhao_user:SUA_SENHA@postgres:5432/milhao_solidario?schema=public
NODE_ENV=production
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
APP_URL=https://seu-link-ou-dominio
ADMIN_API_SECRET=uma_senha_admin_opcional
```

## Webhook Mercado Pago

Configure no Mercado Pago:

```txt
https://seu-link-ou-dominio/api/mercado-pago-pix/webhook
```

Evento:

```txt
payment
```

## O que mudou visualmente

- Removida a área branca em volta dos blocos.
- Home agora é praticamente só o grid.
- A pessoa toca no grid antes de ir para o checkout.
- Ao tocar em um bloco verde, aparece a área escolhida.
- O checkout recebe a área escolhida e pede nome, WhatsApp e CPF.
