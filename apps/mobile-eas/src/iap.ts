import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ?? "";
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ?? "";
/** RevenueCat entitlement identifier (create as "pro" in the RC dashboard). */
export const PRO_ENTITLEMENT = "pro";
/** Offering package lookup — prefer monthly package named "$rc_monthly" or custom. */
const PACKAGE_HINTS = ["$rc_monthly", "monthly", "pro_monthly", "default"];

let configured = false;

export function isIapConfigured(): boolean {
  return Platform.OS === "ios" ? Boolean(IOS_API_KEY) : Boolean(ANDROID_API_KEY);
}

export async function configureIap(appUserId?: string | null): Promise<boolean> {
  if (!isIapConfigured()) return false;
  if (configured) {
    if (appUserId) {
      try {
        await Purchases.logIn(appUserId);
      } catch {
        // ignore login races
      }
    }
    return true;
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);
    const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;
    await Purchases.configure({
      apiKey,
      appUserID: appUserId || undefined,
    });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

function pickPackage(packages: PurchasesPackage[]): PurchasesPackage | null {
  for (const hint of PACKAGE_HINTS) {
    const match = packages.find(
      (p) => p.identifier === hint || p.product.identifier.includes(hint.replace("$rc_", ""))
    );
    if (match) return match;
  }
  return packages[0] ?? null;
}

export async function purchasePro(): Promise<{
  ok: boolean;
  customerInfo?: CustomerInfo;
  originalTransactionId?: string;
  productId?: string;
  error?: string;
}> {
  if (!(await configureIap())) {
    return { ok: false, error: "In-app purchases are not configured yet." };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current?.availablePackages?.length) {
      return {
        ok: false,
        error: "No App Store subscription products are available yet. Try again later.",
      };
    }

    const pkg = pickPackage(current.availablePackages);
    if (!pkg) {
      return { ok: false, error: "No subscription package found." };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
    if (!active) {
      return {
        ok: false,
        error: "Purchase completed but Pro entitlement is not active yet.",
        customerInfo,
      };
    }

    const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
    return {
      ok: true,
      customerInfo,
      originalTransactionId:
        entitlement?.latestPurchaseDate ||
        entitlement?.originalPurchaseDate ||
        customerInfo.originalAppUserId,
      productId: entitlement?.productIdentifier ?? pkg.product.identifier,
    };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) {
      return { ok: false, error: "Purchase cancelled." };
    }
    return {
      ok: false,
      error: err?.message ?? "Purchase failed. Please try again.",
    };
  }
}

export async function restorePro(): Promise<{
  ok: boolean;
  customerInfo?: CustomerInfo;
  originalTransactionId?: string;
  productId?: string;
  error?: string;
}> {
  if (!(await configureIap())) {
    return { ok: false, error: "In-app purchases are not configured yet." };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
    if (!entitlement) {
      return { ok: false, error: "No active MyMotiveLife Pro subscription found to restore." };
    }
    return {
      ok: true,
      customerInfo,
      originalTransactionId: entitlement.originalPurchaseDate,
      productId: entitlement.productIdentifier,
    };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, error: err?.message ?? "Restore failed." };
  }
}

/** Prefer StoreKit transaction id when RevenueCat exposes it on the entitlement. */
export function extractTransactionId(customerInfo: CustomerInfo): string | null {
  const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT];
  if (!entitlement) return null;
  // RevenueCat may put the store transaction in nonSubscriptionTransactions / subscriptionsByProductIdentifier
  const productId = entitlement.productIdentifier;
  const sub = customerInfo.subscriptionsByProductIdentifier?.[productId] as
    | { storeTransactionId?: string; originalPurchaseDate?: string }
    | undefined;
  if (sub?.storeTransactionId) return sub.storeTransactionId;
  return entitlement.originalPurchaseDate ?? customerInfo.originalAppUserId ?? null;
}
