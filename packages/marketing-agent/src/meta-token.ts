/** Exchange system/user token for a Page access token (required for Page publishing). */
export async function resolveMetaPageAccessToken(
  token: string,
  pageId: string
): Promise<{ ok: true; pageToken: string } | { ok: false; error: string }> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`
  );
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 500) };
  }

  let data: { access_token?: string };
  try {
    data = JSON.parse(text) as { access_token?: string };
  } catch {
    return { ok: false, error: "Invalid Meta page token response." };
  }

  if (!data.access_token) {
    return {
      ok: false,
      error:
        "Could not get Page access token. Set MARKETING_META_PAGE_ID to your Facebook Page ID (not the system user ID) and ensure the token has pages_manage_posts on that Page.",
    };
  }

  return { ok: true, pageToken: data.access_token };
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
