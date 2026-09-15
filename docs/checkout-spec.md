# Especificação — `POST /checkout`

> **SDD (Spec-Driven Development).** Este documento é escrito **antes** do código.
> Ele é a fonte da verdade do contrato: os testes em `api/tests/checkout.test.ts`
> derivam diretamente dos cenários descritos aqui, e o front consome exatamente
> este formato em `web/src/lib/api.ts`.

## 1. Objetivo

Registrar a compra de um produto, reservando o estoque de forma atômica e
devolvendo um pedido confirmado. A operação é **idempotente**: a mesma
`Idempotency-Key` nunca gera dois pedidos.

## 2. Requisição

```
POST /checkout
```

### 2.1 Headers

| Header | Obrigatório | Formato | Descrição |
| --- | --- | --- | --- |
| `Content-Type` | sim | `application/json` | Corpo em JSON. |
| `Authorization` | sim | `Bearer <token>` | Identifica o cliente. Token inválido ou ausente → `401`. |
| `Idempotency-Key` | sim | UUID (v4) | Chave única da tentativa de compra. Repetir a chave **não** cria outro pedido. |
| `X-Correlation-Id` | não | string (1–128 chars) | Rastreio ponta a ponta nos logs. Se ausente, o servidor gera um UUID. **Sempre** devolvido na resposta. |

### 2.2 Body

```json
{
  "productId": 1,
  "quantity": 2
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `productId` | inteiro | Obrigatório. Deve existir no catálogo. |
| `quantity` | inteiro | Obrigatório. `>= 1`. Não aceita decimal, negativo, zero ou string. |

> **O preço nunca vem do front.** O valor unitário e o total são resolvidos pelo
> backend a partir do catálogo. Qualquer campo de preço enviado no body é ignorado
> — isso impede que o cliente manipule o valor da compra.

## 3. Resposta de sucesso — `201 Created`

Headers: `X-Correlation-Id: <id>`

```json
{
  "orderId": "order_9f1c0f1e-4a0e-4a1e-9c2a-9a1c0f1e4a0e",
  "status": "confirmed",
  "items": [
    {
      "productId": 1,
      "productName": "Capinha Azul",
      "quantity": 2,
      "unitPrice": 10
    }
  ],
  "total": 20,
  "createdAt": "2026-09-15T12:00:00.000Z"
}
```

### 3.1 Replay idempotente

Repetir a requisição com a **mesma** `Idempotency-Key` e o **mesmo** body devolve
o pedido original, com o mesmo `201` e o header `Idempotency-Replayed: true`.
O estoque é debitado **uma única vez**.

## 4. Respostas de erro

Formato único para todos os erros:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Capinha Verde está esgotado no momento.",
    "correlationId": "9f1c0f1e-4a0e-4a1e-9c2a-9a1c0f1e4a0e"
  }
}
```

| Status | `code` | Quando | `message` |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `productId` ausente ou não inteiro | `Informe um produto válido para concluir a compra.` |
| `400` | `VALIDATION_ERROR` | `quantity` zero, negativa, decimal ou não numérica | `A quantidade deve ser um número inteiro maior ou igual a 1.` |
| `400` | `VALIDATION_ERROR` | `Idempotency-Key` ausente ou fora do formato UUID | `Informe um Idempotency-Key válido no formato UUID.` |
| `400` | `VALIDATION_ERROR` | body ausente ou JSON malformado | `Corpo da requisição inválido. Envie um JSON com productId e quantity.` |
| `401` | `UNAUTHORIZED` | `Authorization` ausente, malformado ou token inválido | `Autenticação obrigatória para concluir a compra.` |
| `404` | `PRODUCT_NOT_FOUND` | `productId` não existe no catálogo | `Produto não encontrado.` |
| `404` | `NOT_FOUND` | rota inexistente | `Recurso não encontrado.` |
| `409` | `INSUFFICIENT_STOCK` | estoque zerado | `<Produto> está esgotado no momento.` |
| `409` | `INSUFFICIENT_STOCK` | estoque menor que o pedido | `Estoque insuficiente: restam apenas N unidade(s) de <Produto>.` |
| `422` | `IDEMPOTENCY_KEY_REUSE` | mesma chave com body diferente | `Esta Idempotency-Key já foi usada com outros dados.` |
| `500` | `SERVER_ERROR` | falha inesperada | `Erro de servidor inesperado.` |
| `503` | `SERVICE_UNAVAILABLE` | dependência (ERP) fora do ar | `Serviço temporariamente indisponível. Tente novamente em instantes.` |

## 5. Regras de negócio

1. **Atomicidade.** A verificação de estoque e o débito acontecem na mesma operação
   síncrona (`reserveStock`), sem `await` entre elas. Duas requisições concorrentes
   pelo último item resultam em `201` para uma e `409` para a outra — nunca estoque negativo.
2. **Ordem de validação.** Auth (`401`) → formato da `Idempotency-Key` (`400`) →
   body (`400`) → replay/conflito de chave (`201` / `422`) → dependência externa (`503`)
   → reserva de estoque (`404` / `409`).
   As checagens baratas vêm primeiro: nada de reservar estoque para uma requisição
   que seria rejeitada depois. O replay vem **antes** da checagem do ERP de propósito —
   quem está retentando uma compra já concluída recebe o pedido original mesmo com a
   dependência instável.
3. **Idempotência com TTL.** As chaves ficam em memória por 24h. Depois disso a mesma
   chave pode gerar um novo pedido.
4. **Correlação.** Todo log do checkout carrega o `correlationId`, e ele volta no header
   e no corpo do erro para o suporte cruzar cliente ↔ servidor.

## 6. Por que definir o contrato antes de escrever código

- **Serve de documentação executável** durante a implementação: não se perde tempo
  decidindo status code no meio da rota.
- **Os testes nascem do contrato.** Cada linha da tabela de erros vira um caso de teste.
- **Front e back trabalham em paralelo**, cada um contra o mesmo contrato, sem um
  bloquear o outro.

## 7. Cenários de teste derivados (TDD)

Cada item abaixo tem um teste correspondente em `api/tests/checkout.test.ts`:

| # | Cenário | Esperado |
| --- | --- | --- |
| 1 | Compra válida | `201` + pedido + estoque debitado |
| 2 | Race condition: N requisições simultâneas, 1 em estoque | exatamente um `201`, o resto `409`, estoque final `0` |
| 3 | Quantidade `0`, negativa, decimal ou string | `400 VALIDATION_ERROR` |
| 4 | Produto inexistente | `404 PRODUCT_NOT_FOUND` |
| 5 | Quantidade maior que o estoque | `409 INSUFFICIENT_STOCK` |
| 6 | ERP/dependência indisponível | `503 SERVICE_UNAVAILABLE` |
| 7 | 3 chamadas com a mesma `Idempotency-Key` | 1 pedido só, mesmo `orderId`, estoque debitado uma vez |
| 8 | Mesma chave com body diferente | `422 IDEMPOTENCY_KEY_REUSE` |
| 9 | Sem `Authorization` / token inválido | `401 UNAUTHORIZED` |
| 10 | Erro inesperado na camada de dados | `500 SERVER_ERROR` |
| 11 | Preço enviado pelo cliente | ignorado; total calculado pelo catálogo |
