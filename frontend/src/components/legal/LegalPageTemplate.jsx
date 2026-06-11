import Link from "next/link"
import Image from "next/image"

export function LegalPageTemplate({
  title,
  description,
  lastUpdated,
  sections,
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="StockSense" width={30} height={30} className="rounded-md" priority />
            <span className="text-sm font-semibold tracking-tight">StockSense</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-10 px-4 py-12 md:px-6 md:py-16">
        <section className="space-y-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">Legal</p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="max-w-3xl text-pretty text-muted-foreground md:text-lg">{description}</p>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </section>

        <section className="space-y-6">
          {sections.map((section) => (
            <article key={section.heading} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="border-t border-white/10 pt-5 text-sm leading-relaxed text-muted-foreground md:pt-6">
          <p>
            Investment disclaimer: StockSense provides informational content and does not provide investment,
            legal, accounting or tax advice. Any investment decision is made solely by you and involves risk,
            including potential loss of principal.
          </p>
        </section>
      </main>
    </div>
  )
}
