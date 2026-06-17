# Mural 29 — Tijolinho Digital

Versão ajustada para o projeto comercial de venda de tijolinhos digitais.

## O que esta versão traz

- Fundo do grid substituído por versão técnica da imagem limpa, convertida para encaixar bloco por bloco.
- Logo novo `Mural 29` aplicado no cabeçalho.
- Imagem de marcação usada como referência para as áreas restritas.
- Grid configurado em **232 colunas x 125 linhas = exatamente 29.000 blocos**.
- Imagem do mural em **2320 x 1250 px**, com cada bloco do site representando **10 x 10 px** da imagem.
- Áreas principais:
  - Copacabana: R$ 9,00 por tijolinho
  - Leblon: R$ 149,00 por tijolinho
  - Ipanema: R$ 49,00 por tijolinho
- Divisão dos bairros preservada no grid atual, com a linha visual centralizada no vão preto entre as linhas douradas.
- Área nobre Tom Delfim Moreira mantida acima da placa do Leblon, sem recalcular o grid.
- Sem taxa extra operacional.
- Docker mantido no modo leve para EasyPanel com pouca memória.

## Arquivos importantes

```txt
public/mural-rio.png          # nova imagem de fundo limpa
public/logo-mural-29.png      # logo novo
lib/grid.ts                   # tamanho do grid e áreas restritas
config/site.config.json       # textos, preços e marca
prisma/seed.js                # cria grid novo
prisma/sync-grid-categories.js # sincroniza grid em banco já existente
```

## Depois de subir no EasyPanel

Se for banco novo:

```bash
pnpm exec prisma db push
pnpm run seed
```

Se o banco já existe:

```bash
pnpm run sync:grid
```

## Variáveis necessárias

```txt
DATABASE_URL=postgresql://...
NODE_ENV=production
MERCADO_PAGO_ACCESS_TOKEN=...
APP_URL=https://seu-link-atual
NEXT_PUBLIC_APP_URL=https://seu-link-atual
ADMIN_API_SECRET=sua_senha_admin_opcional
```

## Observação comercial/legal

Este é um projeto comercial de venda de espaços digitais em um mural público. A compra de tijolinhos digitais não constitui doação, investimento, sorteio, rifa ou promessa de retorno financeiro.


## V15

- Grid/mural travado para preencher a tela no celular.
- Zoom mínimo não deixa o grid diminuir demais.
- Navegação mobile prioriza arrastar para os lados, com eixo vertical centralizado.


## V18
- Corrige o mobile para o grid não diminuir demais.
- O zoom mínimo agora sempre cobre a tela.
- O usuário continua podendo dar zoom e arrastar para os lados.
- O eixo vertical segue centralizado no celular.


## V19
- Troca a imagem do mural para a nova arte enviada.
- Remove a área privada/restrita.
- Cria a área nobre Tom Delfim Moreira acima da placa do Leblon.
- Preço da área nobre: R$ 500,00 por bloco.
- Mantém o comportamento do grid fixo no mobile.
- Bloqueia o zoom nativo do navegador para evitar o mural encolher na tela.


## V20
- Não mexe na estrutura do grid: 232 x 125, 29.000 blocos, tamanho e coordenadas preservados.
- Corrige Prisma para aceitar GRAND_CENTER em transações e placements.
- Publicação pós-PIX entra como `PUBLISHED_NOT_REVIEWED`, mantendo revisão posterior pelo admin.
- Todos os blocos podem receber imagem no checkout.
- Checkout passa a exigir aceite dos termos antes de gerar PIX.
- Admin ganha base para motivo obrigatório nas ações, histórico de ação, solicitações futuras de edição e controle interno de disputa/chargeback.
- Scripts de seed/sync foram alinhados às coordenadas atuais do grid para não desfazer a marcação correta do Tom Delfim Moreira.
