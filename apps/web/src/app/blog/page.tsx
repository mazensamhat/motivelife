import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { listPublishedSeoPosts, seoPostPublicPath, type PublishedSeoPost } from "@/lib/seo-blog";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles & guides",
  description:
    "Tips on Kashu Safe to Spend, KINZO family intelligence, AI life coaching, DayO briefings, and getting more from MotiveLife.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: `${getSiteUrl()}/blog`,
    title: "MotiveLife articles & guides",
    description:
      "Guides on Kashu, KINZO, Digital Twin, and the MotiveLife suite — DayO, LifeVue, UPLIFT, VYRA.",
    siteName: "MotiveLife",
  },
};

function PostCard({ post }: { post: PublishedSeoPost }) {
  return (
    <li>
      <Link
        href={seoPostPublicPath(post.slug)}
        className="block rounded-2xl border border-forward-200 bg-white p-5 transition hover:border-brand-blue/30 hover:shadow-sm"
      >
        {post.kind ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">
            {post.kind === "guide" ? "Guide" : "Article"}
          </p>
        ) : null}
        <h2 className={`text-lg font-semibold text-forward-900 ${post.kind ? "mt-1" : ""}`}>
          {post.title}
        </h2>
        {post.metaDescription ? (
          <p className="mt-2 text-sm leading-relaxed text-forward-600">{post.metaDescription}</p>
        ) : null}
        <p className="mt-3 text-xs text-forward-500">
          {post.publishedAt.toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </Link>
    </li>
  );
}

export default async function BlogIndexPage() {
  const posts = await listPublishedSeoPosts();
  const guides = posts.filter((post) => post.kind === "guide");
  const articleOnly = posts.filter((post) => post.kind !== "guide");

  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="nav" className="shrink-0" />
        <Link href="/" className="text-sm text-forward-500 hover:text-forward-900">
          Back home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <h1 className="text-3xl font-semibold text-forward-900">Articles & guides</h1>
        <p className="mt-2 text-sm text-forward-600">
          Practical reads on MotiveLife, the Digital Twin, and how to use the product day to day.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-sm text-forward-500">New articles are on the way.</p>
        ) : (
          <div className="mt-10 space-y-12">
            {articleOnly.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-forward-500">
                  Articles
                </h2>
                <ul className="mt-4 space-y-4">
                  {articleOnly.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </ul>
              </section>
            ) : null}

            {guides.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-forward-500">
                  Product guides
                </h2>
                <ul className="mt-4 space-y-4">
                  {guides.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
