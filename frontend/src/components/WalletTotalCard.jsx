import { useEffect, useMemo, useState } from "react";

const W = 600;
const H = 110;
const PAD = 4;
const DAY = 24 * 60 * 60 * 1000;
const POINTS = 168;
const TTL = 5 * 60 * 1000;
const cache = new Map(); // coingeckoId -> { at, promise }

function fetchSeries(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;

  const promise = fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7`,
    { headers: { accept: "application/json" } }
  ).then(async (res) => {
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = await res.json();
    return json.prices || [];
  });

  cache.set(id, { at: Date.now(), promise });
  promise.catch(() => cache.delete(id));
  return promise;
}

// value of today's holdings at each past moment (price history x current amount)
function buildSeries(list) {
  const end = Math.max(...list.map((l) => l.prices[l.prices.length - 1][0]));
  const start = end - 7 * DAY;
  const ptr = list.map(() => 0);
  const out = [];

  for (let k = 0; k < POINTS; k++) {
    const t = start + (k / (POINTS - 1)) * (end - start);
    let v = 0;

    list.forEach((l, i) => {
      const p = l.prices;
      while (ptr[i] < p.length - 1 && p[ptr[i] + 1][0] <= t) ptr[i]++;
      v += l.amount * p[ptr[i]][1];
    });

    out.push({ t, v });
  }

  return out;
}

function Chart({ series }) {
  const values = series.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const x = (i) => PAD + (i / (series.length - 1)) * (W - 2 * PAD);
  const y = (v) =>
    max === min
      ? H / 2
      : H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD);

  const line = series
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;

  return (
    <svg
      className="wallet-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Wallet value, last 7 days"
    >
      <defs>
        <linearGradient id="walletFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#walletFill)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * holdings: [{ id: coingeckoId, amount: number }]  (balance > 0, has a CoinGecko id)
 */
export default function WalletTotalCard({
  totalText,
  estimated,
  unpriced,
  holdings,
  chartExcludes,
  updatedAt,
}) {
  const [series, setSeries] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | empty | error
  const [partial, setPartial] = useState(false);
  const [tick, setTick] = useState(0);
  const [usable, setUsable] = useState([]); // ids that have 7-day history
  const [now, setNow] = useState(0);

  // ticks every second so "updated Ns ago" counts up between price refreshes
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const key = useMemo(
    () => holdings.map((h) => `${h.id}:${h.amount}`).join("|"),
    [holdings]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setTick((n) => n + 1);
    }, TTL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!holdings.length) {
      setSeries(null);
      setStatus("empty");
      return;
    }

    let cancelled = false;
    setStatus((s) => (s === "ready" ? s : "loading"));

    (async () => {
      const results = await Promise.allSettled(
        holdings.map((h) => fetchSeries(h.id))
      );
      if (cancelled) return;

      const ok = [];
      let failed = 0;

      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.length > 1) {
          ok.push({ id: holdings[i].id, amount: holdings[i].amount, prices: r.value });
        } else {
          failed += 1;
        }
      });

      if (!ok.length) {
        setSeries(null);
        setStatus("error");
        return;
      }

      setSeries(buildSeries(ok));
      setUsable(ok.map((o) => o.id));
      setPartial(failed > 0);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  // Right edge of the chart = the live value of the same tokens at the latest
  // CoinGecko price, so the chart moves every time prices refresh.
  const liveSeries = useMemo(() => {
    if (!series) return null;
    const live = holdings
      .filter((h) => usable.includes(h.id))
      .reduce((sum, h) => sum + h.amount * h.price, 0);
    return live > 0 ? [...series, { t: 0, v: live }] : series;
  }, [series, holdings, usable]);

  const ago =
    updatedAt && now ? Math.max(0, Math.floor((now - updatedAt.getTime()) / 1000)) : null;

  const change =
    liveSeries && liveSeries[0].v > 0
      ? ((liveSeries[liveSeries.length - 1].v - liveSeries[0].v) /
          liveSeries[0].v) *
        100
      : null;
  const up = change == null || change >= 0;

  return (
    <div className="wallet-total">
      <div className="wallet-total-left">
        <strong className="wallet-total-value">
          {estimated ? "≈ " : ""}
          {totalText}
        </strong>
        {estimated && (
          <span className="wallet-total-note">
            Estimated: testnet tokens are valued at their real-asset price for
            display only.
          </span>
        )}
        <span className="wallet-live">
          <span className="wallet-live-dot" />
          {ago == null ? "Live" : `Live · updated ${ago}s ago`}
        </span>
        {unpriced > 0 && (
          <span className="wallet-total-note">
            {unpriced} token{unpriced > 1 ? "s" : ""} with no available price
            not included.
          </span>
        )}
      </div>

      <div className={`wallet-total-chart ${up ? "up" : "down"}`}>
        {status === "ready" && liveSeries ? (
          <>
            <div className="wallet-chart-head">
              <span>Last 7 days · live from CoinGecko</span>
              {change != null && (
                <strong>
                  {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                </strong>
              )}
            </div>
            <Chart series={liveSeries} />
            {(partial || chartExcludes) && (
              <span className="wallet-chart-note">
                Chart excludes tokens without CoinGecko price history.
              </span>
            )}
          </>
        ) : (
          <p className="wallet-chart-empty">
            {status === "loading"
              ? "Loading 7-day chart…"
              : status === "empty"
                ? "No CoinGecko-priced tokens in this wallet yet."
                : "7-day chart unavailable right now."}
          </p>
        )}
      </div>
    </div>
  );
}
