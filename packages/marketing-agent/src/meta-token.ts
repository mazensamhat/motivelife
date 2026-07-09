function metaBusinessId(): string | undefined {
  return process.env.MARKETING_META_BUSINESS_ID?.trim() || undefined;
}

async function pageTokenFromOwnedPages(
  token: string,
  businessId: string,
  pageId: string
): Promise<{ ok: true; pageToken: string } | { ok: false; error: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${businessId}/owned_pages?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(token)}`
  );
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 500) };
  }

  let data: { data?: Array<{ id?: string; name?: string; access_token?: string }> };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, error: "Invalid Meta owned_pages response." };
  }

  const match = data.data?.find((p) => p.id === pageId);
  if (!match?.access_token) {
    const names = (data.data ?? []).map((p) => `${p.name ?? "?"} (${p.id})`).join(", ");
    return {
      ok: false,
      error: `Page ${pageId} not in business portfolio owned pages. Found: ${names || "none"}. Assign the Page to your System User in Business Settings.`,
    };
  }

  return { ok: true, pageToken: match.access_token };
}

/** True when token can already call Graph API for this Page (e.g. a Page access token). */
async function tokenWorksForPage(
  token: string,
  pageId: string
): Promise<boolean> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`
  );
  return res.ok;
}

/** Exchange system/user token for a Page access token (required for Page publishing). */
export async function resolveMetaPageAccessToken(
  token: string,
  pageId: string
): Promise<{ ok: true; pageToken: string } | { ok: false; error: string }> {
  if (await tokenWorksForPage(token, pageId)) {
    return { ok: true, pageToken: token };
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`
  );
  const text = await res.text();
  if (res.ok) {
    let data: { access_token?: string };
    try {
      data = JSON.parse(text) as { access_token?: string };
    } catch {
      return { ok: false, error: "Invalid Meta page token response." };
    }

    if (data.access_token) {
      return { ok: true, pageToken: data.access_token };
    }
  }

  const businessId = metaBusinessId();
  if (businessId) {
    const owned = await pageTokenFromOwnedPages(token, businessId, pageId);
    if (owned.ok) return owned;
    if (!res.ok) {
      return { ok: false, error: `${text.slice(0, 280)} | owned_pages: ${owned.error.slice(0, 220)}` };
    }
  }

  if (!res.ok) {
    return { ok: false, error: text.slice(0, 500) };
  }

  return {
    ok: false,
    error:
      "Could not get Page access token. Assign the Page to your System User, set MARKETING_META_BUSINESS_ID, or set a per-brand Page token (MARKETING_MOTIVELIFE_META_ACCESS_TOKEN).",
  };
}

export type BrandMetaConnectionTest = {
  brandId: string;
  pageId: string;
  instagramAccountId?: string;
  pageToken: boolean;
  instagram: boolean;
  error?: string;
  pageName?: string;
  instagramUsername?: string;
};

/** Live Graph API check — which brands can actually publish with current env. */
export async function testBrandMetaConnection(input: {
  brandId: string;
  metaAccessToken?: string;
  metaPageId?: string;
  instagramAccountId?: string;
}): Promise<BrandMetaConnectionTest> {
  const pageId = input.metaPageId?.trim() ?? "";
  const token = input.metaAccessToken?.trim() ?? "";
  const result: BrandMetaConnectionTest = {
    brandId: input.brandId,
    pageId,
    instagramAccountId: input.instagramAccountId,
    pageToken: false,
    instagram: false,
  };

  if (!token || !pageId) {
    result.error = "Missing meta access token or page ID.";
    return result;
  }

  const pageAuth = await resolveMetaPageAccessToken(token, pageId);
  if (!pageAuth.ok) {
    result.error = pageAuth.error;
    return result;
  }
  result.pageToken = true;

  const pageRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAuth.pageToken)}`
  );
  if (pageRes.ok) {
    const pageData = (await pageRes.json()) as { name?: string };
    result.pageName = pageData.name;
  }

  const igResolved = await resolveInstagramBusinessAccount(pageId, pageAuth.pageToken);
  if (igResolved.ok) {
    result.instagram = true;
    result.instagramUsername = igResolved.username;
  } else if (input.instagramAccountId) {
    result.instagram = true;
  } else {
    result.error = igResolved.error;
  }

  return result;
}

/** Poll until Instagram media container is ready for media_publish. */
export async function waitForInstagramMediaContainer(
  containerId: string,
  pageToken: string,
  maxWaitMs = 120_000
): Promise<{ ok: true } | { ok: false; error: string }> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${encodeURIComponent(pageToken)}`
    );
    const data = (await res.json()) as { status_code?: string; error?: { message?: string } };
    if (!res.ok) {
      const msg = data.error?.message ?? JSON.stringify(data).slice(0, 300);
      return { ok: false, error: msg };
    }
    const status = data.status_code;
    if (status === "FINISHED") return { ok: true };
    if (status === "ERROR" || status === "EXPIRED") {
      return { ok: false, error: `Instagram media processing failed (${status}).` };
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return {
    ok: false,
    error: "Instagram media still processing — wait 30–60s and click Publish again.",
  };
}

/** Read the IG Business account linked to a Facebook Page (preferred over a manual env ID). */
export async function resolveInstagramBusinessAccount(
  pageId: string,
  pageToken: string
): Promise<
  | { ok: true; igUserId: string; username?: string }
  | { ok: false; error: string }
> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pageToken)}`
  );
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 500) };
  }

  let data: { instagram_business_account?: { id?: string; username?: string } };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, error: "Invalid Meta Instagram lookup response." };
  }

  const igUserId = data.instagram_business_account?.id?.trim();
  if (!igUserId) {
    return {
      ok: false,
      error:
        "No Instagram Business account is linked to this Facebook Page. In Meta Business Settings → Accounts → Instagram accounts → connect your IG Business account to the Page.",
    };
  }

  return {
    ok: true,
    igUserId,
    username: data.instagram_business_account?.username,
  };
}
