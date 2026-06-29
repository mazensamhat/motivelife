import { cookies } from "next/headers";
import {
  GENERATIONS,
  getGenerationFromBirthYear,
  getGenerationTheme,
  type Generation,
} from "./generation";
import { PREVIEW_COOKIE_NAME } from "./generation-preview-constants";

export function parsePreviewGeneration(value: string | undefined): Generation | null {
  if (value && GENERATIONS.includes(value as Generation)) {
    return value as Generation;
  }
  return null;
}

export async function getResolvedGeneration(birthYear: number | null | undefined) {
  const cookieStore = await cookies();
  const preview = parsePreviewGeneration(cookieStore.get(PREVIEW_COOKIE_NAME)?.value);
  const profileGeneration = getGenerationFromBirthYear(birthYear);
  const generation = preview ?? profileGeneration;
  const theme = getGenerationTheme(generation);
  const profileTheme = getGenerationTheme(profileGeneration);

  return {
    generation,
    profileGeneration,
    theme,
    profileTheme,
    isPreview: preview != null,
  };
}
