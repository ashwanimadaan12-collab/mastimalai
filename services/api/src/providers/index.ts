// Provider interfaces + local/dev implementations. Production swaps these
// (S3 storage, ffmpeg transcode worker, Razorpay payments) behind the same
// interfaces — no changes needed in the modules that consume them.

// ---------- Storage ----------
export interface StorageProvider {
  // Returns a browser-usable URL for a stored streaming asset.
  publicUrl(path: string): string;
}

class LocalStorage implements StorageProvider {
  publicUrl(path: string) {
    // In dev, streaming assets are just URLs stored on the VideoAsset row.
    return path;
  }
}

// ---------- Transcode ----------
export type TranscodeResult = {
  status: "READY" | "FAILED";
  hlsPath?: string;
  streamUrl?: string;
  renditions?: { height: number; bandwidth: number }[];
};

export interface TranscodeProvider {
  // Real impl enqueues an ffmpeg/HLS job on a worker and returns immediately
  // with PROCESSING; a callback later marks the asset READY. This stub is a
  // passthrough because ffmpeg is not available on the dev host.
  transcode(sourcePath: string): Promise<TranscodeResult>;
}

class StubTranscoder implements TranscodeProvider {
  async transcode(sourcePath: string): Promise<TranscodeResult> {
    return { status: "READY", streamUrl: sourcePath };
  }
}

// ---------- Payments ----------
export type CreatedOrder = {
  orderId: string;
  amount: number;
  currency: string;
};
export type VerifyInput = {
  orderId: string;
  // In a real gateway these are signature fields; here it's an explicit sandbox flag.
  sandboxApprove?: boolean;
  paymentId?: string;
  signature?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: {
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<CreatedOrder>;
  // Returns true only when the payment is genuinely verified server-side.
  verify(input: VerifyInput): Promise<boolean>;
}

// LOCAL SANDBOX: never contacts a real gateway. Approves only when the client
// explicitly passes sandboxApprove=true, so the "verify server-side" flow is
// exercised end to end without processing real money.
class LocalSandboxPayments implements PaymentProvider {
  readonly name = "local-sandbox";
  async createOrder(input: {
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<CreatedOrder> {
    return {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
    };
  }
  async verify(input: VerifyInput): Promise<boolean> {
    return input.sandboxApprove === true;
  }
}

export const storage: StorageProvider = new LocalStorage();
export const transcoder: TranscodeProvider = new StubTranscoder();
export const payments: PaymentProvider = new LocalSandboxPayments();
