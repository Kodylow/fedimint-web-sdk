import { WorkerClient } from '../worker'
import type {
  CreateBolt11Response,
  GatewayInfo,
  JSONObject,
  JSONValue,
  LightningGateway,
  LnPayState,
  LnReceiveState,
  MSats,
  OutgoingLightningPayment,
} from '../types'

export class LightningService {
  constructor(private client: WorkerClient) {}

  async createInvoiceWithGateway(
    amount: MSats,
    description: string,
    expiryTime: number | null = null, // in seconds
    extraMeta: JSONObject = {},
    gatewayInfo: GatewayInfo,
  ) {
    return await this.client.rpcSingle('ln', 'create_bolt11_invoice', {
      amount,
      description,
      expiry_time: expiryTime,
      extra_meta: extraMeta,
      gateway: gatewayInfo,
    })
  }

  async createInvoice(
    amount: MSats,
    description: string,
    expiryTime: number | null = null, // in seconds
    extraMeta: JSONObject = {},
  ): Promise<CreateBolt11Response> {
    await this.updateGatewayCache()
    const gateway = await this._getDefaultGatewayInfo()
    return await this.client.rpcSingle('ln', 'create_bolt11_invoice', {
      amount,
      description,
      expiry_time: expiryTime,
      extra_meta: extraMeta,
      gateway: gateway.info,
    })
  }

  async createInvoiceTweakedWithGateway(
    amount: MSats,
    description: string,
    expiryTime: number | null = null, // in seconds
    index: number,
    extraMeta: JSONObject = {},
    gatewayInfo: GatewayInfo,
  ): Promise<CreateBolt11Response> {
    return await this.client.rpcSingle(
      'ln',
      'create_bolt11_invoice_for_user_tweaked',
      {
        amount,
        description,
        expiry_time: expiryTime,
        index,
        extra_meta: extraMeta,
        gateway: gatewayInfo,
      },
    )
  }

  async createInvoiceTweaked(
    amount: MSats,
    description: string,
    expiryTime: number | null = null, // in seconds
    publicKey: string,
    index: number,
    extraMeta: JSONObject = {},
  ): Promise<CreateBolt11Response> {
    await this.updateGatewayCache()
    const gateway = await this._getDefaultGatewayInfo()
    return await this.client.rpcSingle(
      'ln',
      'create_bolt11_invoice_for_user_tweaked',
      {
        amount,
        description,
        expiry_time: expiryTime,
        user_key: publicKey,
        index,
        extra_meta: extraMeta,
        gateway: gateway.info,
      },
    )
  }

  // Returns the operation ids of payments received to the tweaks of the user secret key
  async scanReceivesForTweaks(
    userKey: string,
    indices: number[],
    extraMeta: JSONObject = {},
  ): Promise<string[]> {
    return await this.client.rpcSingle('ln', 'scan_receive_for_user_tweaks', {
      user_key: userKey,
      indices,
      extra_meta: extraMeta,
    })
  }

  async payInvoiceWithGateway(
    invoice: string,
    gatewayInfo: GatewayInfo,
    extraMeta: JSONObject = {},
  ) {
    return await this.client.rpcSingle('ln', 'pay_bolt11_invoice', {
      maybe_gateway: gatewayInfo,
      invoice,
      extra_meta: extraMeta,
    })
  }

  private async _getDefaultGatewayInfo(): Promise<LightningGateway> {
    const gateways = await this.listGateways()
    return gateways[0]
  }

  async payInvoice(
    invoice: string,
    extraMeta: JSONObject = {},
  ): Promise<OutgoingLightningPayment> {
    await this.updateGatewayCache()
    const gateway = await this._getDefaultGatewayInfo()
    return await this.client.rpcSingle('ln', 'pay_bolt11_invoice', {
      maybe_gateway: gateway.info,
      invoice,
      extra_meta: extraMeta,
    })
  }

  subscribeLnClaim(
    operationId: string,
    onSuccess: (state: LnReceiveState) => void = () => {},
    onError: (error: string) => void = () => {},
  ) {
    const unsubscribe = this.client.rpcStream(
      'ln',
      'subscribe_ln_claim',
      { operation_id: operationId },
      onSuccess,
      onError,
    )

    return unsubscribe
  }

  subscribeLnPay(
    operationId: string,
    onSuccess: (state: LnPayState) => void = () => {},
    onError: (error: string) => void = () => {},
  ) {
    const unsubscribe = this.client.rpcStream(
      'ln',
      'subscribe_ln_pay',
      { operation_id: operationId },
      onSuccess,
      onError,
    )

    return unsubscribe
  }

  subscribeLnReceive(
    operationId: string,
    onSuccess: (state: LnReceiveState) => void = () => {},
    onError: (error: string) => void = () => {},
  ) {
    const unsubscribe = this.client.rpcStream(
      'ln',
      'subscribe_ln_receive',
      { operation_id: operationId },
      onSuccess,
      onError,
    )

    return unsubscribe
  }

  async waitForReceive(operationId: string): Promise<LnReceiveState> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribeLnReceive(
        operationId,
        (res) => {
          if (res === 'claimed') resolve(res)
        },
        reject,
      )
      setTimeout(() => {
        unsubscribe()
        reject(new Error('Timeout waiting for receive'))
      }, 10000)
    })
  }

  async getGateway(
    gatewayId: string | null = null,
    forceInternal: boolean = false,
  ): Promise<LightningGateway | null> {
    return await this.client.rpcSingle('ln', 'get_gateway', {
      gateway_id: gatewayId,
      force_internal: forceInternal,
    })
  }

  async listGateways(): Promise<LightningGateway[]> {
    return await this.client.rpcSingle('ln', 'list_gateways', {})
  }

  async updateGatewayCache(): Promise<JSONValue> {
    return await this.client.rpcSingle('ln', 'update_gateway_cache', {})
  }
}
