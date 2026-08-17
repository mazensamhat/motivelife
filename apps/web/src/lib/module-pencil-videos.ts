/** MotiveLife suite — short product overview videos (~45s). */

export type ModulePencilVideoId =
  | "dayo"
  | "lifevue"
  | "kinzo"
  | "uplift"
  | "kashu"
  | "vyra";

export type ModulePencilVideo = {
  id: ModulePencilVideoId;
  label: string;
  tagline: string;
  href: string;
  videoSrc: string;
  posterSrc: string;
  durationLabel: string;
  blurb: string;
};

export const MODULE_PENCIL_VIDEOS: ModulePencilVideo[] = [
  {
    id: "dayo",
    label: "DayO",
    tagline: "Your day, briefed",
    href: "/#products",
    videoSrc: "/marketing/modules/dayo.mp4",
    posterSrc: "/marketing/modules/dayo-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "One morning mission. Voice becomes tasks. Protect focus.",
  },
  {
    id: "lifevue",
    label: "LifeVue",
    tagline: "Your life in one view",
    href: "/#digital-twin",
    videoSrc: "/marketing/modules/lifevue.mp4",
    posterSrc: "/marketing/modules/lifevue-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "Digital Twin signals across health, money, time, and goals.",
  },
  {
    id: "kinzo",
    label: "KINZO AI",
    tagline: "Family intelligence in motion",
    href: "/family",
    videoSrc: "/marketing/modules/kinzo.mp4",
    posterSrc: "/marketing/modules/kinzo-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "Live map, routines, and calm alerts — peace without hovering.",
  },
  {
    id: "uplift",
    label: "UPLIFT",
    tagline: "Your goals, elevated",
    href: "/#products",
    videoSrc: "/marketing/modules/uplift.mp4",
    posterSrc: "/marketing/modules/uplift-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "North-star aims linked to weekly missions you can finish.",
  },
  {
    id: "kashu",
    label: "Kashu",
    tagline: "Know what's safe before you spend",
    href: "/cash-flow",
    videoSrc: "/marketing/modules/kashu.mp4",
    posterSrc: "/marketing/modules/kashu-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "Safe to Spend after obligations — no bank connect required.",
  },
  {
    id: "vyra",
    label: "VYRA AI",
    tagline: "Your AI Chief of Staff",
    href: "/#products",
    videoSrc: "/marketing/modules/vyra.mp4",
    posterSrc: "/marketing/modules/vyra-poster.jpg",
    durationLabel: "~45 sec",
    blurb: "Ask once. Get a plan, a priority, and a next action.",
  },
];

export function getModulePencilVideo(
  id: ModulePencilVideoId
): ModulePencilVideo | undefined {
  return MODULE_PENCIL_VIDEOS.find((v) => v.id === id);
}
