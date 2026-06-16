# Milhão Solidário — versão seleção de bloco exato

Esta versão corrige o fluxo para o cliente selecionar **blocos exatos no grid**, com regra de contiguidade:

```txt
1. O cliente toca no bloco que deseja
2. Pode selecionar mais blocos
3. Todo novo bloco precisa estar encostado em algum bloco já selecionado
4. Depois clica em Continuar
5. Checkout pede nome, WhatsApp e CPF
6. Depois gera PIX Mercado Pago
```

## O que mudou

- Home voltou a ter cabeçalho fixo no topo.
- Grid começa abaixo do cabeçalho.
- Removido o modelo de seleção por região.
- Removido cabeçalho flutuante.
- Cliente seleciona bloco por bloco com o dedo/clique.
- Blocos selecionados ficam destacados.
- O sistema bloqueia seleção longe dos blocos já escolhidos.
- Checkout recebe `blocks=7:0,8:0` na URL.
- Checkout pede nome, WhatsApp e CPF.
- API calcula o preço com base nos blocos realmente selecionados.

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

## Variáveis no EasyPanel

```txt
DATABASE_URL=postgresql://milhao_user:SUA_SENHA@postgres:5432/milhao_solidario?schema=public
NODE_ENV=production
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
APP_URL=https://seu-link-ou-dominio
ADMIN_API_SECRET=uma_senha_admin_opcional
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

## Webhook Mercado Pago

Configure no Mercado Pago:

```txt
https://seu-link-ou-dominio/api/mercado-pago-pix/webhook
```

Evento:

```txt
payment
```
