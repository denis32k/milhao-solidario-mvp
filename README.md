# Tijolinho Digital — V1 conceito comercial

Projeto Next.js/Prisma/PostgreSQL com Mercado Pago PIX, admin, testes do mural e configuração central.

## Conceito

O projeto agora é um mural comercial gamificado feito de tijolinhos digitais.

Frase principal:

> Compre seu tijolinho digital e ajude a construir um dos murais mais ambiciosos da internet.

Este é um projeto comercial de venda de espaços digitais em um mural público. A compra de tijolinhos digitais não constitui doação, investimento, sorteio, rifa ou promessa de retorno financeiro.

## Áreas públicas

- Copacabana — área de entrada/acessível, inspirada na calçada com ondas preto e branco.
- Jardins — área premium, visual sofisticado com verde escuro e pedra clara.
- Leblon — área mega especial/exclusiva, visual champagne e dourado sutil.
- Área reservada — centro fechado temporariamente para uma ação futura.

## Matemática do grid

- Grid total: 200 x 145 = 29.000 tijolinhos.
- Copacabana: 10.000 tijolinhos em volta de todo o mural.
- Jardins: 18.600 tijolinhos no miolo principal.
- Leblon: 300 tijolinhos em volta do centro reservado.
- Área reservada: 100 tijolinhos bloqueados no centro, quadrado 10x10.

## Fases da Obra

- Terreno Aberto
- Fundação
- Primeira Parede
- Fachada em Construção
- Bairro Valorizado
- Marco da Internet
- Obra Histórica
- Mural Completo

A progressão é calculada por percentual de tijolinhos vendidos no mural.

## Configuração editável

Altere textos, valores, nomes, logo simples, cores e dados fictícios em:

```txt
config/site.config.json
```

## Deploy / atualização do banco

Depois de subir no EasyPanel, rode:

```bash
npx prisma generate
npx prisma db push
npm run sync:grid
```

O `sync:grid` é obrigatório quando a distribuição de áreas/preços mudar.

## Testes no admin

Acesse:

```txt
/admin?secret=SUA_SENHA
```

Funções de teste:

- Criar teste Copacabana
- Criar teste Jardins
- Criar teste Leblon
- Excluir teste individual
- Excluir todos os testes

Testes não passam pelo checkout, não geram PIX e não entram na totais comerciais/ranking/relatórios.

## Preservado

- Checkout existente
- Reservas e expiração
- Status dos tijolinhos
- Mercado Pago PIX
- Webhook
- Admin/moderação
- Upload de imagens
- Denúncias
