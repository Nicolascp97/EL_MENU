import assert from 'node:assert/strict'
import test from 'node:test'
import { formatUnitInfo } from '../src/lib/orderMessage.ts'
import { resolvePresentation, splitEnvaseContent, buildEnvaseUnit } from '../src/lib/units.ts'

type ProductInput = Parameters<typeof resolvePresentation>[0]

function product(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    price: 3_380,
    price_wholesale: null,
    unit: 'kg',
    unit_wholesale: null,
    unit_qty: 1,
    unit_qty_wholesale: null,
    ...overrides,
  }
}

/**
 * Los 27 valores de `unit` que existen hoy en la base de producción, con un
 * precio real de cada caso. Si alguien agrega un formato nuevo y no lo entiende
 * el parser, esta tabla es la que lo delata.
 */
const FORMATOS_REALES: [descripcion: string, entrada: Partial<ProductInput>, label: string, perMeasure: string | null][] = [
  ['atado suelto',        { unit: '1 atado', price: 1_200 },            'Atado',               null],
  ['caja suelta',         { unit: '1 caja', price: 22_000 },            'Caja',                null],
  ['kilo suelto',         { unit: '1 kg', price: 1_490 },               '1 kg',                null],
  ['paquete suelto',      { unit: '1 paq', price: 1_000 },              'Paquete',             null],
  ['unidad suelta',       { unit: '1 unid', price: 990 },               '1 Unidad',            null],
  // Limitación conocida: 'medio' no es una cantidad que el parser sepa leer.
  // Se muestra tal cual, que para "Medio Repollo" es aceptable.
  ['medio repollo',       { unit: '1/2 unid', price: 800 },             '1/2 Unid',            null],
  ['docena de huevos',    { unit: '12 unid', price: 4_200 },            '12 unidades',         '$350 c/u'],
  ['champiñón 200g',      { unit: '200 gr', price: 1_990 },             '200 gr',              '$9.950 el kilo'],
  ['jengibre 250g',       { unit: '250 gr', price: 1_990 },             '250 gr',              '$7.960 el kilo'],
  ['pack papas 3kg',      { unit: '3 kg', price: 2_970 },               '3 kg',                '$990 el kilo'],
  ['ajos x3',             { unit: '3 unid', price: 1_290 },             '3 unidades',          '$430 c/u'],
  ['huevos x30',          { unit: '30 unid', price: 9_900 },            '30 unidades',         '$330 c/u'],
  ['cherry 300g',         { unit: '300 gr', price: 1_990 },             '300 gr',              '$6.633 el kilo'],
  ['beterraga x5',        { unit: '5 unid', price: 1_990 },             '5 unidades',          '$398 c/u'],
  ['cebolla 500g',        { unit: '500 gr', price: 990 },               '500 gr',              '$1.980 el kilo'],
  ['camote 550g',         { unit: '550 gr', price: 1_490 },             '550 gr',              '$2.709 el kilo'],
  ['caja sin contenido',  { unit: 'caja', price: 19_500 },              'Caja',                null],
  ['caja de 14 lechugas', { unit: 'caja 14u', price: 18_000 },          'Caja 14 unidades',    '$1.286 c/u'],
  ['aceituna 250g',       { unit: 'gr', unit_qty: 250, price: 2_200 },  '250 gr',              '$8.800 el kilo'],
  ['saco papas 25kg',     { unit: 'kg', unit_qty: 25, price: 15_000 },  '25 kg',               '$600 el kilo'],
  ['malla cebolla 17kg',  { unit: 'malla 17kg', price: 20_000 },        'Malla 17 kg',         '$1.176 el kilo'],
  ['paquete acelga',      { unit: 'paq', price: 3_500 },                'Paquete',             null],
  ['saco zanahoria',      { unit: 'saco 17kg', price: 22_000 },         'Saco 17 kg',          '$1.294 el kilo'],
  ['saco papas lavadas',  { unit: 'saco 24kg', unit_qty: 24, price: 14_000 }, 'Saco 24 kg',    '$583 el kilo'],
  ['ají x6',              { unit: 'unid', unit_qty: 6, price: 990 },    '6 unidades',          '$165 c/u'],
  // Los tres que corrige la migración 0017
  ['limón caja 17kg',     { unit: 'caja 17kg', price: 7_500 },          'Caja 17 kg',          '$441 el kilo'],
  ['cebollín docena',     { unit: 'paq 12u', price: 9_000 },            'Paquete 12 unidades', '$750 c/u'],
  ['pack cebollas x3',    { unit: 'unid', unit_qty: 3, price: 1_000 },  '3 unidades',          '$333 c/u'],
]

for (const [descripcion, entrada, label, perMeasure] of FORMATOS_REALES) {
  test(`formato real: ${descripcion}`, () => {
    const presentation = resolvePresentation(product(entrada))
    assert.equal(presentation.label, label)
    assert.equal(presentation.perMeasure, perMeasure)
  })
}

test('no inventa cantidad cuando el envase no declara contenido', () => {
  const presentation = resolvePresentation(product({ price: 22_000, unit: 'caja', unit_qty: 1 }))

  assert.equal(presentation.label, 'Caja')
  assert.equal(presentation.perMeasure, null)
})

test('usa unidad, cantidad y precio mayorista cuando corresponde', () => {
  const presentation = resolvePresentation(product({
    price: 3_380,
    price_wholesale: 6_300,
    unit: 'gr',
    unit_qty: 250,
    unit_wholesale: 'gr',
    unit_qty_wholesale: 500,
  }), { wholesale: true })

  assert.equal(presentation.label, '500 gr')
  assert.equal(presentation.perMeasure, '$12.600 el kilo')
})

test('cae a la cantidad minorista cuando la mayorista viene vacía', () => {
  const presentation = resolvePresentation(product({
    price: 1_800,
    price_wholesale: 1_400,
    unit: 'gr',
    unit_qty: 250,
    unit_wholesale: 'gr',
    unit_qty_wholesale: null,
  }), { wholesale: true })

  assert.equal(presentation.label, '250 gr')
  assert.equal(presentation.perMeasure, '$5.600 el kilo')
})

test('ignora la unidad mayorista cuando el producto no la define', () => {
  const presentation = resolvePresentation(product({
    price: 2_200,
    price_wholesale: 1_900,
    unit: 'gr',
    unit_qty: 250,
    unit_wholesale: null,
  }), { wholesale: true })

  assert.equal(presentation.label, '250 gr')
})

test('coincide con la etiqueta del mensaje de pedido en unidades limpias', () => {
  const presentation = resolvePresentation(product({ unit: 'gr', unit_qty: 250 }))

  assert.equal(presentation.label, formatUnitInfo(1, 'gr', 250))
})

// ─── Envase + contenido: lo que escribe y lee el panel admin ────────────────

test('arma el unit descriptivo que guarda el panel', () => {
  assert.equal(buildEnvaseUnit('caja', 18, 'kg'), 'caja 18kg')
  assert.equal(buildEnvaseUnit('malla', 40, 'unid'), 'malla 40unid')
  assert.equal(buildEnvaseUnit('caja', null, 'kg'), 'caja')
})

test('vuelve a leer el contenido guardado para precargar el panel', () => {
  assert.deepEqual(splitEnvaseContent('caja 18kg'), { envase: 'caja', qty: 18, base: 'kg' })
  assert.deepEqual(splitEnvaseContent('saco 24kg'), { envase: 'saco', qty: 24, base: 'kg' })
  assert.deepEqual(splitEnvaseContent('caja 14u'), { envase: 'caja', qty: 14, base: 'unid' })
})

test('no confunde una unidad limpia con un envase con contenido', () => {
  assert.equal(splitEnvaseContent('caja'), null)
  assert.equal(splitEnvaseContent('gr'), null)
  assert.equal(splitEnvaseContent('1 kg'), null)
  assert.equal(splitEnvaseContent(''), null)
})

test('ida y vuelta: lo que guarda el panel es lo que el panel vuelve a leer', () => {
  const guardado = buildEnvaseUnit('caja', 18, 'kg')
  assert.deepEqual(splitEnvaseContent(guardado), { envase: 'caja', qty: 18, base: 'kg' })
  assert.equal(resolvePresentation(product({ unit: guardado, price: 22_000 })).label, 'Caja 18 kg')
})
