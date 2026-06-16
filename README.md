# Milhão Solidário — pacote consolidado

Projeto Next.js mobile-first com PostgreSQL/Prisma, Mercado Pago PIX e grid de 29.000 blocos.

## O que este pacote já inclui

- Grid 200 x 145 = 29.000 blocos.
- Mosaico Solidário: 10.000 blocos de R$ 10,00.
- Área Premium: 18.990 blocos de R$ 100,00, ainda com tela visual/placeholder.
- Centro Grandioso: 10 blocos bloqueados.
- Taxa operacional e tributária de 10%.
- Home lendo arrecadação real do banco.
- Ranking real.
- Mapa lendo blocos vendidos reais.
- Checkout PIX Mercado Pago para Mosaico Solidário.
- Webhook Mercado Pago em `/api/mercado-pago-pix/webhook`.
- Botão “Já paguei, verificar pagamento”.
- Limpeza de reservas expiradas.
- Consulta admin das últimas transações.
- Dockerfile para EasyPanel.

## Variáveis no EasyPanel

No serviço do site, configure:

```txt
DATABASE_URL=postgresql://milhao_user:SUA_SENHA@postgres:5432/milhao_solidario?schema=public
NODE_ENV=production
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
APP_URL=https://seu-dominio.com.br
```

Opcional, mas recomendado antes de lançar:

```txt
ADMIN_API_SECRET=uma_senha_grande_aqui
```

Se preencher `ADMIN_API_SECRET`, as rotas admin precisam ser chamadas com:

```txt
/api/admin/latest-transactions?secret=uma_senha_grande_aqui
/api/admin/release-expired-reservations?secret=uma_senha_grande_aqui
```

## Deploy no EasyPanel

Use a fonte GitHub e build com Dockerfile.

Depois do primeiro deploy, rode no terminal Sh do serviço:

```bash
npx prisma generate
npx prisma db push
node prisma/seed.js
```

## Webhook Mercado Pago

No painel Mercado Pago Developers, configure o webhook:

```txt
https://seu-dominio.com.br/api/mercado-pago-pix/webhook
```

Evento:

```txt
payment
```

## URLs úteis

```txt
/api/stats
/api/map/blocks
/api/mercado-pago-pix
/api/mercado-pago-pix/webhook
/api/admin/latest-transactions
/api/admin/release-expired-reservations
```

## Limpar reservas expiradas

Reserva normal expirada:

```txt
/api/admin/release-expired-reservations
```

Liberar todas as reservas pendentes, só para teste/admin:

```txt
/api/admin/release-expired-reservations?force=true
```

## Atenção antes de lançar

- Não subir `.env` com senha/token para GitHub.
- Configurar domínio real e SSL.
- Atualizar `APP_URL` quando trocar domínio.
- Revisar termos com contador/advogado.
- Proteger rotas admin com `ADMIN_API_SECRET`.
