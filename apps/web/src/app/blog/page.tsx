import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { listPublishedSeoPosts, seoPostPublicPath } from "@/lib/seo-blog";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Articles & guides",
  description:
    "Tips on AI life coaching, goal planning, habits, and getting more from MotiveLife — your AI chief of staff.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: `${getSiteUrl()}/blog`,
    title: "MotiveLife articles",
    description: "Guides and insights from MotiveLife — AI life operating system.",
    siteName: "MotiveLife",
  },
};

export default async function BlogIndexPage() {
  const posts = await listPublishedSeoPosts();

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
          Practical reads on productivity, goals, and using AI to run your life.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-sm text-forward-500">New articles are on the way.</p>
        ) : (
          <ul className="mt-10 space-y-4">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={seoPostPublicPath(post.slug)}
                  className="block rounded-2xl border border-forward-200 bg-white p-5 transition hover:border-brand-blue/30 hover:shadow-sm"
                >
                  <h2 className="text-lg font-semibold text-forward-900">{post.title}</h2>
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
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
