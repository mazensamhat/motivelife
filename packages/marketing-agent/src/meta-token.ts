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
