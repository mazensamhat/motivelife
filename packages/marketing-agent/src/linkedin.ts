import type { MarketingBrandId, PublishPayload, PublishResult } from "./types";
import {
  getBrandPublisherConfig,
  linkedInEnvKeyPresence,
} from "./brand-publishers";

/** LinkedIn REST versions are YYYYMM and rotate ~monthly; 202410 is sunset. */
function resolveLinkedInApiVersion(): string {
  const raw = process.env.MARKETING_LINKEDIN_API_VERSION?.trim() || "202606";
  // Accept YYYYMM or accidental YYYYMMDD (LinkedIn rejects day-suffixed values).
  if (/^\d{6}\.\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) return raw.slice(0, 6);
  if (/^\d{6}$/.test(raw)) return raw;
  return "202606";
}

const LINKEDIN_API_VERSION = resolveLinkedInApiVersion();

export type LinkedInBrandProbe = {
  brandId: MarketingBrandId;
  apiVersion: string;
  env: ReturnType<typeof linkedInEnvKeyPresence>;
  organizationAclsStatus: number | null;
  organizationAclsOk: boolean;
  imageInitStatus: number | null;
  imageInitOk: boolean;
  imageInitError: string | null;
  orgsSeen: Array<{ id: number; vanityName: string }>;
};

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

async function uploadLinkedInVideo(
  orgId: string,
  token: string,
  buffer: Buffer
): Promise<string> {
  const initRes = await fetch(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    {
      method: "POST",
      headers: linkedInHeaders(token),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: organizationUrn(orgId),
          fileSizeBytes: buffer.length,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`LinkedIn video init failed: ${err.slice(0, 300)}`);
  }

  const initData = (await initRes.json()) as {
    value?: {
      video?: string;
      uploadToken?: string;
      uploadInstructions?: Array<{
        uploadUrl?: string;
        firstByte?: number;
        lastByte?: number;
      }>;
    };
  };
  const videoUrn = initData.value?.video;
  const uploadToken = initData.value?.uploadToken ?? "";
  const instructions = initData.value?.uploadInstructions ?? [];
  if (!videoUrn || instructions.length === 0) {
    throw new Error("LinkedIn video upload response missing video URN or instructions");
  }

  const uploadedPartIds: string[] = [];
  for (const part of instructions) {
    const uploadUrl = part.uploadUrl;
    if (!uploadUrl) {
      throw new Error("LinkedIn video part missing uploadUrl");
    }
    const first = part.firstByte ?? 0;
    const last = part.lastByte ?? buffer.length - 1;
    const chunk = buffer.subarray(first, last + 1);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(chunk),
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LinkedIn video part upload failed: ${err.slice(0, 300)}`);
    }
    const etag =
      uploadRes.headers.get("etag") ??
      uploadRes.headers.get("ETag") ??
      uploadRes.headers.get("Etag");
    if (!etag) {
      throw new Error("LinkedIn video part upload missing ETag header");
    }
    uploadedPartIds.push(etag.replace(/^"|"$/g, ""));
  }

  const finalizeRes = await fetch(
    "https://api.linkedin.com/rest/videos?action=finalizeUpload",
    {
      method: "POST",
      headers: linkedInHeaders(token),
      body: JSON.stringify({
        finalizeUploadRequest: {
          video: videoUrn,
          uploadToken,
          uploadedPartIds,
        },
      }),
    }
  );
  if (!finalizeRes.ok) {
    const err = await finalizeRes.text();
    throw new Error(`LinkedIn video finalize failed: ${err.slice(0, 300)}`);
  }

  await waitForLinkedInVideoAvailable(token, videoUrn);
  return videoUrn;
}

async function waitForLinkedInVideoAvailable(
  token: string,
  videoUrn: string,
  timeoutMs = 120_000
): Promise<void> {
  const encoded = encodeURIComponent(videoUrn);
  const started = Date.now();
  let lastStatus = "UNKNOWN";

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`https://api.linkedin.com/rest/videos/${encoded}`, {
      headers: linkedInHeaders(token, false),
    });
    if (res.ok) {
      const data = (await res.json()) as { status?: string };
      lastStatus = data.status ?? lastStatus;
      if (data.status === "AVAILABLE") return;
      if (data.status === "PROCESSING_FAILED" || data.status === "FAILED") {
        throw new Error(`LinkedIn video processing failed (${data.status})`);
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  throw new Error(
    `LinkedIn video not ready after ${Math.round(timeoutMs / 1000)}s (status=${lastStatus})`
  );
}

async function createLinkedInPost(
  orgId: string,
  token: string,
  commentary: string,
  media?: { urn: string; title?: string }
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

  if (media?.urn) {
    body.content = {
      media: {
        id: media.urn,
        ...(media.title ? { title: media.title.slice(0, 200) } : {}),
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
  orgId: string,
  text: string
): Promise<PublishResult> {
  const org = orgId.trim();
  const mediaUrl = payload.mediaUrl?.trim();
  const tokenMeta = `${token.slice(0, 4)}…${token.slice(-4)} len=${token.length}`;

  try {
    let media: { urn: string; title?: string } | undefined;
    if (mediaUrl && payload.mediaType === "video") {
      const { buffer } = await fetchMediaBytes(mediaUrl);
      if (buffer.length > 5 * 1024 * 1024 * 1024) {
        throw new Error("LinkedIn rejects videos larger than 5GB.");
      }
      const videoUrn = await uploadLinkedInVideo(org, token, buffer);
      const title =
        payload.title?.trim() ||
        text.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 120);
      media = { urn: videoUrn, title };
    } else if (mediaUrl && (payload.mediaType === "image" || payload.mediaType === "gif")) {
      const { buffer, contentType } = await fetchMediaBytes(mediaUrl);
      const imageUrn = await uploadLinkedInImage(org, token, buffer, contentType);
      media = { urn: imageUrn };
    }

    const externalId = await createLinkedInPost(org, token, text, media);
    return { ok: true, externalId, mode: "api" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn publish failed";
    const withMeta = message.includes("INVALID_ACCESS_TOKEN")
      ? `${message} [token ${tokenMeta}; org ${org}; LinkedIn-Version ${LINKEDIN_API_VERSION}]`
      : message;
    return { ok: false, error: withMeta, mode: "manual", manualText: text };
  }
}

/** Live LinkedIn credential check for Ops — never returns the raw token. */
export async function probeLinkedInBrand(
  brandId: MarketingBrandId
): Promise<LinkedInBrandProbe> {
  const env = linkedInEnvKeyPresence(brandId);
  const cfg = getBrandPublisherConfig(brandId);
  const token = cfg.linkedinAccessToken;
  const orgId = cfg.linkedinOrgId?.trim();

  const result: LinkedInBrandProbe = {
    brandId,
    apiVersion: LINKEDIN_API_VERSION,
    env,
    organizationAclsStatus: null,
    organizationAclsOk: false,
    imageInitStatus: null,
    imageInitOk: false,
    imageInitError: null,
    orgsSeen: [],
  };

  if (!token) return result;

  try {
    const aclRes = await fetch(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName,vanityName),role,state))",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    result.organizationAclsStatus = aclRes.status;
    result.organizationAclsOk = aclRes.ok;
    if (aclRes.ok) {
      const data = (await aclRes.json()) as {
        elements?: Array<{
          "organization~"?: { id?: number; vanityName?: string };
        }>;
      };
      result.orgsSeen = (data.elements ?? [])
        .map((el) => ({
          id: el["organization~"]?.id ?? 0,
          vanityName: el["organization~"]?.vanityName ?? "",
        }))
        .filter((o) => o.id);
    }
  } catch (error) {
    result.imageInitError =
      error instanceof Error ? error.message.slice(0, 200) : "organizationAcls failed";
  }

  if (!orgId) return result;

  try {
    const initRes = await fetch(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      {
        method: "POST",
        headers: linkedInHeaders(token),
        body: JSON.stringify({
          initializeUploadRequest: { owner: organizationUrn(orgId) },
        }),
      }
    );
    result.imageInitStatus = initRes.status;
    result.imageInitOk = initRes.ok;
    if (!initRes.ok) {
      result.imageInitError = (await initRes.text()).slice(0, 300);
    }
  } catch (error) {
    result.imageInitError =
      error instanceof Error ? error.message.slice(0, 200) : "image init failed";
  }

  return result;
}
