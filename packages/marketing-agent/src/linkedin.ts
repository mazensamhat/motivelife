import type { PublishPayload, PublishResult } from "./types";

const LINKEDIN_API_VERSION =
  process.env.MARKETING_LINKEDIN_API_VERSION?.trim() || "202410";

function linkedInHeaders(token: string, json = true): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_API_VERSION,
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function organizationUrn(orgId: string): string {
  return `urn:li:organization:${orgId.trim()}`;
}

async function fetchMediaBytes(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch media for LinkedIn (${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

async function uploadLinkedInImage(
  orgId: string,
  token: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const initRes = await fetch(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      method: "POST",
      headers: linkedInHeaders(token),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: organizationUrn(orgId),
        },
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`LinkedIn image init failed: ${err.slice(0, 300)}`);
  }

  const initData = (await initRes.json()) as {
    value?: { uploadUrl?: string; image?: string };
  };
  const uploadUrl = initData.value?.uploadUrl;
  const imageUrn = initData.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image upload response missing uploadUrl or image URN");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType.split(";")[0]?.trim() || "image/jpeg",
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`LinkedIn image upload failed: ${err.slice(0, 300)}`);
  }

  return imageUrn;
}

async function createLinkedInPost(
  orgId: string,
  token: string,
  commentary: string,
  imageUrn?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    author: organizationUrn(orgId),
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrn) {
    body.content = {
      media: {
        id: imageUrn,
      },
    };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: linkedInHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err.slice(0, 500));
  }

  const postId = res.headers.get("x-restli-id");
  if (postId) return postId;

  const data = (await res.json()) as { id?: string };
  return data.id ?? "linkedin-post";
}

export async function publishLinkedIn(
  payload: PublishPayload,
  token: string,
  text: string
): Promise<PublishResult> {
  const orgId = process.env.MARKETING_LINKEDIN_ORG_ID!.trim();
  const mediaUrl = payload.mediaUrl?.trim();

  try {
    if (payload.mediaType === "video") {
      return {
        ok: false,
        error:
          "LinkedIn video auto-post is not enabled yet — use Image for now or copy the post manually.",
        mode: "manual",
        manualText: text,
      };
    }

    let imageUrn: string | undefined;
    if (mediaUrl && (payload.mediaType === "image" || payload.mediaType === "gif")) {
      const { buffer, contentType } = await fetchMediaBytes(mediaUrl);
      imageUrn = await uploadLinkedInImage(orgId, token, buffer, contentType);
    }

    const externalId = await createLinkedInPost(orgId, token, text, imageUrn);
    return { ok: true, externalId, mode: "api" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publish failed";
    return { ok: false, error: message, mode: "manual", manualText: text };
  }
}
