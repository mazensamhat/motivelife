import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { MarkdownContent } from "@/components/markdown-content";
import { getPublishedSeoPostBySlug, seoPostPublicPath } from "@/lib/seo-blog";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedSeoPostBySlug(slug);
  if (!post) {
    return { title: "Article not found" };
  }

  const canonical = seoPostPublicPath(slug);

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.keywords.length > 0 ? post.keywords : undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: `${getSiteUrl()}${canonical}`,
      title: post.metaTitle,
      description: post.metaDescription,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      siteName: "MotiveLife",
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedSeoPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-forward-50">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <BrandLogo href="/" size="nav" className="shrink-0" />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/blog" className="text-forward-500 hover:text-forward-900">
            All articles
          </Link>
          <Link href="/register" className="font-medium text-brand-blue hover:underline">
            Start free trial
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        <article>
          <p className="text-xs font-semibold uppercase tracking-widest text-forward-500">MotiveLife</p>
          <h1 className="mt-2 text-3xl font-semibold text-forward-900 sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-sm text-forward-500">
            {post.publishedAt.toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>

          <div className="mt-8 border-t border-forward-200 pt-8">
            <MarkdownContent body={post.body} />
          </div>
        </article>

        <section className="mt-12 rounded-2xl border border-forward-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-forward-900">Try MotiveLife free for 14 days</h2>
          <p className="mt-2 text-sm leading-relaxed text-forward-600">
            Speak your thoughts and get plans, goals, habits, and daily actions — with AI morning briefings
            and Life Score tracking.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Get started
          </Link>
        </section>
      </main>
    </div>
  );
}
