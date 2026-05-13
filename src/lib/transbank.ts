import {
  WebpayPlus,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
} from 'transbank-sdk'

/**
 * Cliente Transbank Webpay Plus.
 * - Si `TRANSBANK_ENVIRONMENT=production`, usa credenciales del cliente (Celso).
 * - En cualquier otro caso (dev, integration, sin setear), usa las credenciales
 *   públicas de prueba que provee Transbank. La cuenta de prueba siempre
 *   aprueba la tarjeta 4051 8856 0000 0044 con CVV 123 / vto 11/27 y RUT
 *   11.111.111-1 / clave 123.
 */
export function createWebpayPlus() {
  const isProduction = process.env.TRANSBANK_ENVIRONMENT === 'production'

  if (isProduction) {
    const code = process.env.TRANSBANK_COMMERCE_CODE
    const key = process.env.TRANSBANK_API_KEY_SECRET
    if (!code || !key) {
      throw new Error(
        'TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY_SECRET son obligatorias cuando TRANSBANK_ENVIRONMENT=production'
      )
    }
    return WebpayPlus.Transaction.buildForProduction(code, key)
  }

  const code = process.env.TRANSBANK_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS
  const key = process.env.TRANSBANK_API_KEY_SECRET || IntegrationApiKeys.WEBPAY
  return WebpayPlus.Transaction.buildForIntegration(code, key)
}

/** Genera un buyOrder válido para Transbank (max 26 chars). */
export function buyOrderFromUuid(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 26)
}
