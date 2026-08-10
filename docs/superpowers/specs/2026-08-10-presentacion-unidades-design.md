# Presentación consistente de unidades

## Objetivo

Que el cliente entienda **cuánto se lleva** en cada producto. La tarjeta mostraba
`/ gr` sin decir nunca cuántos gramos: la Almendra se veía como "$3.380 / gr"
cuando en realidad son 250 gr. La cantidad estaba guardada en `unit_qty` desde la
migración 0011, pero ninguna vista del cliente la leía.

## Decisión aprobada

Cada precio muestra una etiqueta de presentación (`250 gr`, `Malla 17 kg`, `Caja`)
y, cuando la cantidad es medible y distinta de uno, la equivalencia por medida
(`$13.520 el kilo`, `$600 c/u`). La equivalencia es lo que permite comparar el
formato de detalle contra el mayorista. No se infieren cantidades desde nombres
ambiguos.

## Arquitectura

`src/lib/units.ts` expone `resolvePresentation(product, { wholesale })`, una
función pura sin dependencias — a propósito, para poder testearla con
`node --test` sin levantar Next ni React. Normaliza las dos convenciones que
conviven en la base:

| Convención | Ejemplo | Etiqueta |
|---|---|---|
| Clave limpia + cantidad aparte | `unit='gr'`, `unit_qty=250` | `250 gr` |
| Descriptiva autocontenida | `unit='malla 17kg'` | `Malla 17 kg` |
| Descriptiva con cantidad al frente | `unit='1 paq'` | `Paquete` |

Elige `unit_wholesale` / `unit_qty_wholesale` con **el mismo fallback que los
endpoints de checkout**, para que lo que ve el cliente y lo que se graba en el
pedido no puedan divergir.

Las siete vistas del cliente consumen únicamente ese resultado: tarjeta de
catálogo, carrito lateral, resumen de checkout, detalle de pedido, destacados del
home, tarjetas del chat y pedidos del panel admin.

## Envases con contenido

Un envase (caja, malla, saco, paquete) puede declarar cuánto trae adentro. Se
guarda como un solo string —`'caja 18kg'`— siguiendo la convención que ya existía
en la base (`'malla 17kg'`, `'saco 24kg'`, `'caja 14u'`).

Esto existe porque el modelo anterior no podía expresarlo: `unit='caja'` con
`unit_qty=18` se renderizaba como **"18 cajas"**, no "una caja de 18 kg". El panel
admin ofrecía un `select` cerrado de unidades más un campo numérico, así que el
dueño no tenía forma de declarar el contenido sin escribir SQL.

`ProductsAdminClient` ahora muestra, **solo cuando la unidad es un envase**, un
campo "¿Cuánto trae?" con su medida, y reemplaza al campo de cantidad (que para
un envase significaría "cuántas cajas"). Una vista previa muestra en vivo cómo
lo verá el cliente.

## Límites

- No se modifican `api/checkout/*`, `api/transbank/*`, `lib/orderMessage.ts` ni
  `lib/notify.ts`. **El mensaje de WhatsApp al dueño no cambia de formato**: ya
  funciona y está acoplado al workflow de n8n.
- No cambian precios, stock, totales, contenido del carrito ni órdenes existentes.
  Esto es solo presentación.
- La migración 0017 es idempotente y corrige tres productos inequívocos:
  `Limón Plateado 17kg` (retail **y mayorista** — la caja se vende en ambos
  canales), `Pack Cebollas 3u` y `Cebollín Docena`.
- Los productos cuya cantidad no está confirmada siguen mostrando `Caja`,
  `Paquete` o `Atado`, sin información inventada. Los completa el dueño desde el
  panel con el campo de contenido.

## Limitación conocida

`unit='1/2 unid'` (un solo producto, Medio Repollo) no se parsea: el parser no
lee fracciones y la unidad se muestra tal cual. Es aceptable porque el nombre del
producto ya dice "Medio".

## Cobertura

`npm test` corre el runner de Node sobre `tests/`. Los tests incluyen **una tabla
con los 25 valores de `unit` que existen hoy en producción** más los tres que
introduce la migración: es la red que delata cualquier formato nuevo que el
parser no entienda. Cubren además los fallbacks mayoristas, envase+contenido de
ida y vuelta, y la equivalencia de etiqueta con `formatUnitInfo()`.

`npm run test:e2e` corre Playwright sobre `e2e/`. El `testDir` acotado importa:
sin él Playwright barría `tests/**` con su patrón por defecto e intentaba correr
los unitarios como suyos, que es lo que rompía `npm test`.
