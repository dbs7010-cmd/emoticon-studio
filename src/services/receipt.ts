import type { Entitlement } from '../types';

// 영수증 검증. 스토어가 준 구매 토큰을 **우리 서버**가 구글/애플에 물어보고, 그 대답만이 PRO 를 연다.
// 앱이 스스로 "샀다"고 판단하지 않는 이유는 저장 파일이 사람이 고칠 수 있는 평문이기 때문이다.
//
// 여기 있는 것은 client 쪽 전부다. 없는 것은 **서버 배포와 비밀 키**이고, 그것은 외부 차단이다.
// 서버 주소가 설정되지 않은 빌드에서는 아래 코드가 언제나 'not-configured' 를 돌려주고
// **어떤 경우에도 이용권을 만들지 않는다.**

export type ReceiptRequest = {
  platform: 'android' | 'ios';
  productId: string;
  purchaseToken: string;
  packageName?: string;
};
// 서버가 돌려줘야 하는 모양. 이 모양이 아니면 거절한다 — 반쯤 맞는 대답을 믿지 않는다.
export type ReceiptVerdict = {
  verified: boolean;
  plan: 'monthly' | 'yearly';
  expiresAt?: string;
  // 라이선스 테스터·내부 테스트 구매인지(Play API 의 testPurchase). 받아들일지 말지는 **서버가**
  // 정한다 — 앱이 일괄 거절하면 우리 내부 테스트와 심사에서 결제 흐름이 막히기 때문이다.
  // 앱은 이 값을 화면에 적기 위해서만 쓴다.
  sandbox?: boolean;
  reason?: string;
};
export type ReceiptResult =
  | { state: 'verified'; entitlement: Entitlement }
  | { state: 'refused'; reason: string }
  | { state: 'not-configured'; reason: string }
  | { state: 'unreachable'; reason: string };

export type ReceiptOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  timeoutMs?: number;
};

const PLANS = ['monthly', 'yearly'] as const;

// 서버 대답을 통째로 믿지 않고 한 조각씩 확인한다. 하나라도 어긋나면 거절이다.
export function readVerdict(value: unknown): ReceiptVerdict | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.verified !== 'boolean') return null;
  if (typeof v.plan !== 'string' || !PLANS.includes(v.plan as (typeof PLANS)[number])) return null;
  if (v.expiresAt !== undefined) {
    if (typeof v.expiresAt !== 'string' || Number.isNaN(new Date(v.expiresAt).getTime())) return null;
  }
  if (v.sandbox !== undefined && typeof v.sandbox !== 'boolean') return null;
  if (v.reason !== undefined && typeof v.reason !== 'string') return null;
  return { verified: v.verified, plan: v.plan as 'monthly' | 'yearly', expiresAt: v.expiresAt as string | undefined, sandbox: v.sandbox as boolean | undefined, reason: v.reason as string | undefined };
}

export async function verifyReceipt(request: ReceiptRequest, options: ReceiptOptions = {}): Promise<ReceiptResult> {
  const endpoint = options.endpoint;
  if (!endpoint) return { state: 'not-configured', reason: '영수증 확인 서버 주소가 이 빌드에 설정되어 있지 않아요.' };
  if (!/^https:\/\//.test(endpoint)) return { state: 'not-configured', reason: '영수증 확인은 https 주소로만 보낼 수 있어요.' };
  if (!request.purchaseToken || !request.productId) return { state: 'refused', reason: '구매 정보가 비어 있어요.' };

  const send = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!send) return { state: 'unreachable', reason: '이 환경에서는 네트워크를 쓸 수 없어요.' };

  let response: Response;
  try {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? 10000) : null;
    try {
      response = await send(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } finally { if (timer) clearTimeout(timer); }
  } catch (e) {
    // 물어보지 못한 것은 "아니다"가 아니다. 기존 권한을 건드리지 않고 그대로 알린다.
    return { state: 'unreachable', reason: '영수증 확인 서버에 연결하지 못했어요. ' + String(e).replace(/^Error:\s*/, '') };
  }
  if (!response.ok) return { state: 'unreachable', reason: `영수증 확인 서버가 ${response.status}를 돌려줬어요.` };

  let body: unknown;
  try { body = await response.json(); }
  catch { return { state: 'refused', reason: '영수증 확인 서버의 대답을 읽지 못했어요.' }; }

  const verdict = readVerdict(body);
  if (!verdict) return { state: 'refused', reason: '영수증 확인 서버의 대답이 예상한 모양이 아니에요.' };
  if (!verdict.verified) return { state: 'refused', reason: verdict.reason || '스토어가 이 구매를 확인해 주지 않았어요.' };
  if (verdict.expiresAt && new Date(verdict.expiresAt).getTime() <= (options.now ?? new Date()).getTime())
    return { state: 'refused', reason: '이미 기간이 끝난 구매예요.' };

  return {
    state: 'verified',
    entitlement: {
      plan: verdict.plan,
      source: 'store',
      verified: true,
      expiresAt: verdict.expiresAt,
      checkedAt: (options.now ?? new Date()).toISOString(),
      // 서버가 테스트 구매라고 알려 주면 그대로 기록한다. 화면이 그 사실을 말할 수 있어야 한다.
      test: verdict.sandbox || undefined,
    },
  };
}
