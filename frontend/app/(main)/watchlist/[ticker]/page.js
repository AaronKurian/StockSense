import { WatchlistDetailPage } from "@/components/watchlist/WatchlistDetailPage"

export async function generateMetadata({ params }) {
  const ticker = (await params).ticker?.toUpperCase() ?? "Ticker"
  return { title: `${ticker} — StockSense` }
}

export default async function Page({ params }) {
  const { ticker } = await params
  return <WatchlistDetailPage ticker={ticker} />
}
