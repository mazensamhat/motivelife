import { Hero } from "@/components/hero";
import { MotiveIqReveal } from "@/components/motive-iq-reveal";
import { PlatformLane } from "@/components/platform-lane";
import { ProductMatch } from "@/components/product-match";
import { TrustStrip } from "@/components/trust-strip";
import { isMotiveIq, PLATFORMS } from "@/lib/platforms";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      {PLATFORMS.map((platform, index) =>
        isMotiveIq(platform) ? (
          <MotiveIqReveal key={platform.id} index={index} />
        ) : (
          <PlatformLane key={platform.id} platform={platform} index={index} />
        ),
      )}
      <ProductMatch />
    </>
  );
}
