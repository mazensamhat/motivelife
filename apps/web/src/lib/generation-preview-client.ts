"use client";

import {
  PREVIEW_COOKIE_MAX_AGE,
  PREVIEW_COOKIE_NAME,
} from "./generation-preview-constants";
import type { Generation } from "./generation";

export function setGenerationPreviewCookie(generation: Generation | null) {
  if (generation) {
    document.cookie = `${PREVIEW_COOKIE_NAME}=${generation};path=/;max-age=${PREVIEW_COOKIE_MAX_AGE};SameSite=Lax`;
  } else {
    document.cookie = `${PREVIEW_COOKIE_NAME}=;path=/;max-age=0;SameSite=Lax`;
  }
  window.location.reload();
}
