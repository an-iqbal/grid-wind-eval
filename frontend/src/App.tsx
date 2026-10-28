import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, CircleHelp, Cloud, Download, RefreshCw, ShieldCheck, Wind, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Point = { startTime: string; actualMw: number | null; forecastMw: number | null; errorMw: number | null; publishTime: string | null }
type DayData = { targetDate: string; cutoffUtc: string | null; periodCount: number; pairedCount: number; actualTotalMwh: number | null; maeMw: number | null; rmseMw: number | null; wapePct: number | null; biasMw: number | null; peakErrorMw: number | null; points: Point[]; dataAvailable?: boolean }
type DailySummary = { date: string; day: number; actualPeriods: number; forecastPeriods: number; pairedPeriods: number; missingForecastPeriods: number; missingActualPeriods: number; maeMw: number | null; rmseMw: number | null; wapePct: number | null; biasMw: number | null; actualTotalMwh: number | null }
type MonthData = { period: string; cutoffUtc: string; dataAvailable: boolean; expectedPeriods: number; actualPeriods: number; forecastPeriods: number; evaluatedPeriods: number; missingForecastPeriods: number; missingActualPeriods: number; coveragePct: number; actualTotalMwh: number; overallMetrics: { maeMw: number | null; rmseMw: number | null; wapePct: number | null; biasMw: number | null }; dailyBreakdown: DailySummary[] }
const API = import.meta.env.VITE_API_URL || ''
const defaultData: DayData = { targetDate: '2026-01-21', cutoffUtc: null, periodCount: 0, pairedCount: 0, actualTotalMwh: null, maeMw: null, rmseMw: null, wapePct: null, biasMw: null, peakErrorMw: null, points: [], dataAvailable: false }
const fmt = (n: number | null | undefined, digits = 0) => n == null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })

export default function App() {
  const [date, setDate] = useState('2026-01-21')
  const [gate, setGate] = useState(11)
  const [data, setData] = useState<DayData>(defaultData)
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day')
  const [monthData, setMonthData] = useState<MonthData | null>(null)
  const [monthLoading, setMonthLoading] = useState(false)
  const [monthError, setMonthError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`${API}/api/day/${date}?gate=${String(gate).padStart(2, '0')}:00`)
      if (!response.ok) throw new Error(`API returned ${response.status}`)
      setData(await response.json())
    } catch { setData(defaultData); setError('Could not connect to the data service. Start the Docker stack and try again.') }
    finally { setLoading(false) }
  }, [date, gate])
  useEffect(() => { void load() }, [load])
  const loadMonth = useCallback(async () => {
    setMonthLoading(true); setMonthError('')
    try {
      const response = await fetch(`${API}/api/monthly-summary?gate=${String(gate).padStart(2, '0')}:00`)
      if (!response.ok) throw new Error(`API returned ${response.status}`)
      setMonthData(await response.json())
    } catch { setMonthError('Could not load the January summary. Check the data service and try again.') }
    finally { setMonthLoading(false) }
  }, [gate])
  useEffect(() => { if (viewMode === 'month') void loadMonth() }, [viewMode, loadMonth])
  const sync = async () => {
    setRefreshing(true); setError('')
    try { const r = await fetch(`${API}/api/refresh`, { method: 'POST' }); if (!r.ok) throw new Error(); await load(); if (viewMode === 'month') await loadMonth() }
    catch { setError('Elexon sync could not complete. Check the API connection and try again.') }
    finally { setRefreshing(false) }
  }
  const chartData = useMemo(() => data.points.map(p => ({ ...p, label: new Date(p.startTime).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) })), [data.points])
  const biasPositive = (data.biasMw || 0) >= 0
  const exportCsv = () => {
    const header = 'startTimeUtc,actualMw,forecastMw,gapMw,publishTimeUtc'
    const rows = data.points.map(p => [p.startTime, p.actualMw ?? '', p.forecastMw ?? '', p.errorMw ?? '', p.publishTime ?? ''].join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob); link.download = `wind-desk-${date}.csv`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="shell">
    <aside className="rail">
      <div className="brand-mark"><Wind size={19} strokeWidth={2.2} /></div>
      <div className="rail-divider" />
      <button className="rail-item active" title="Wind desk"><Activity size={18} /></button>
      <button className="rail-item" title="Procurement"><Zap size={18} /></button>
      <button className="rail-item" title="Forecast archive"><CalendarDays size={18} /></button>
      <div className="rail-bottom"><div className="avatar">GB</div></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="crumb">MARKET INTELLIGENCE <span>/</span> GENERATION</div>
        <div className="top-actions"><div className="live-indicator"><i /> ELEXON DATA</div><button className="icon-button" title="Help"><CircleHelp size={17} /></button><div className="profile">NORTHSTAR ENERGY <span>TRADING</span></div></div>
      </header>
      <div className="content">
        <section className="page-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> UK POWER · DAY-AHEAD <span className="period-tag">JAN 2026 PILOT</span></div><h1>Wind desk <span className="slash">/</span> <em>decision view</em></h1><p className="subtitle">A clear read on renewable supply before the market gate closes.</p></div>
          <button className="sync-button" onClick={sync} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> {refreshing ? 'SYNCING ELEXON' : 'SYNC ELEXON'}</button>
        </section>

        <section className="control-panel">
          <div className="control-label"><span>01</span> DELIVERY & DECISION</div>
          <div className="controls-row">
            <label className="date-control"><span className="field-label">DELIVERY DATE</span><span className="input-wrap"><CalendarDays size={16} /><input type="date" min="2026-01-01" max="2026-01-31" value={date} onChange={e => setDate(e.target.value)} /><ChevronDown className="select-caret" size={14} /></span></label>
            <div className="gate-control"><div className="gate-top"><span className="field-label">DECISION GATE <span className="utc">UTC</span></span><span className="gate-value">{String(gate).padStart(2, '0')}:00 <small>· D−1</small></span></div><input aria-label="Decision gate in UTC" type="range" min="6" max="18" step="1" value={gate} onChange={e => setGate(Number(e.target.value))} style={{ '--progress': `${((gate - 6) / 12) * 100}%` } as React.CSSProperties} /><div className="range-ticks"><span>06:00</span><span>12:00</span><span>18:00</span></div></div>
            <div className="cutoff-note"><ShieldCheck size={16} /><div><b>Point-in-time protected</b><span>Only forecasts published by {String(gate).padStart(2, '0')}:00 UTC on D−1</span></div></div>
          </div>
        </section>

        <nav className="view-tabs" aria-label="Analysis view">
          <button className={viewMode === 'day' ? 'selected' : ''} onClick={() => setViewMode('day')}><CalendarDays size={14} /> DAILY DAY-AHEAD VIEW</button>
          <button className={viewMode === 'month' ? 'selected' : ''} onClick={() => setViewMode('month')}><Activity size={14} /> JANUARY 2026 PORTFOLIO VIEW</button>
        </nav>

        {error && <div className="notice error-notice">{error}</div>}
        {viewMode === 'day' && !loading && !error && !data.dataAvailable && <div className="notice"><div className="notice-icon"><Cloud size={18} /></div><div><b>January dataset is not loaded yet</b><span>Sync Elexon to retrieve January 2026 actuals and forecast snapshots. No synthetic values are shown.</span></div><button onClick={sync} disabled={refreshing}>LOAD DATA <ArrowUpRight size={14} /></button></div>}

        {viewMode === 'day' ? <>
        <section className="metrics-section">
          <div className="section-head"><div className="control-label"><span>02</span> PORTFOLIO SNAPSHOT</div><div className="as-of">{data.pairedCount ? `${data.pairedCount} PAIRED HALF-HOURS` : 'HALF-HOURLY · NATIONAL WIND'}</div></div>
          <div className="metric-grid">
            <article className="metric-card generation-card"><div className="metric-top"><span>ACTUAL GENERATION</span><span className="metric-icon"><Wind size={16} /></span></div><div className="metric-value">{fmt(data.actualTotalMwh, 0)}<small> MWh</small></div><div className="metric-foot"><span className="dot green" />Delivery day total · FUELHH</div><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article>
            <article className="metric-card"><div className="metric-top"><span>DAY-AHEAD MAE</span><span className="metric-unit">ERROR</span></div><div className="metric-value">{fmt(data.maeMw, 0)}<small> MW</small></div><div className="metric-foot"><span className="dot amber" />{fmt(data.wapePct, 1)}% weighted absolute error</div><div className="metric-underline amber-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>SYSTEM BIAS</span><span className={`bias-chip ${biasPositive ? 'positive' : 'negative'}`}>{data.biasMw == null ? 'NO DATA' : biasPositive ? 'OVER' : 'UNDER'}</span></div><div className="metric-value">{data.biasMw == null ? '—' : `${data.biasMw > 0 ? '+' : ''}${fmt(data.biasMw, 0)}`}<small> MW</small></div><div className="metric-foot"><span className={`dot ${biasPositive ? 'red' : 'blue'}`} />Forecast − actual · mean error</div><div className="metric-underline blue-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>PEAK PERIOD ERROR</span><span className="metric-unit">30 MIN</span></div><div className="metric-value">{fmt(data.peakErrorMw, 0)}<small> MW</small></div><div className="metric-foot"><span className="dot red" />Largest absolute forecast miss</div><div className="metric-underline red-line" /></article>
          </div>
        </section>

        <section className="chart-panel">
          <div className="chart-header"><div><div className="control-label"><span>03</span> INTRADAY PROFILE</div><h2>Forecast vs. outturn</h2><p>National wind generation <i>·</i> MW per settlement period</p></div><div className="chart-tools"><div className="legend"><span><i className="legend-line actual" /> ACTUAL</span><span><i className="legend-line forecast" /> FORECAST</span><span><i className="legend-bar" /> GAP</span></div><button className="icon-button export" title="Export day data as CSV" onClick={exportCsv}><Download size={16} /></button></div></div>
          <div className="chart-wrap">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 18, right: 5, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="#263536" vertical={false} strokeDasharray="3 5" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#78888a', fontSize: 10, fontFamily: 'DM Mono' }} interval={5} dy={12} />
            <YAxis yAxisId="mw" axisLine={false} tickLine={false} tick={{ fill: '#78888a', fontSize: 10, fontFamily: 'DM Mono' }} width={46} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} />
            <YAxis yAxisId="gap" orientation="right" hide domain={['auto', 'auto']} />
            <Tooltip content={<ChartTooltip />} />
            <Bar yAxisId="gap" dataKey="errorMw" name="Gap" fill="#e7a544" fillOpacity={0.25} maxBarSize={14} radius={[2, 2, 0, 0]} />
            <Line yAxisId="mw" type="monotone" dataKey="actualMw" name="Actual" stroke="#a5d47d" strokeWidth={2.3} dot={false} activeDot={{ r: 4, fill: '#a5d47d', stroke: '#0e1a1b', strokeWidth: 2 }} connectNulls />
            <Line yAxisId="mw" type="monotone" dataKey="forecastMw" name="Forecast" stroke="#62b6aa" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, fill: '#62b6aa', stroke: '#0e1a1b', strokeWidth: 2 }} connectNulls />
          </ComposedChart></ResponsiveContainer> : <div className="chart-empty"><div className="empty-glyph"><Activity size={23} /></div><b>Awaiting wind series</b><span>Load Elexon data to see the 48 settlement periods for this delivery day.</span></div>}</div>
          <div className="chart-footer"><span><i className="dot green" />DATA: ELEXON BMRS · FUELHH / WINDFOR</span><span><i className="dot slate" />FORECAST SNAPSHOT AT {data.cutoffUtc ? `${String(gate).padStart(2, '0')}:00 UTC · D−1` : 'DECISION GATE'}</span><span>RESOLUTION <b>30 MIN</b></span></div>
        </section>

        <section className="insight-row"><div className="insight-icon"><Zap size={17} /></div><div className="insight-copy"><b>Procurement signal</b><span>{data.biasMw == null ? 'Once data is loaded, signed forecast bias gives the desk a quick read on typical over- or under-procurement exposure.' : `${biasPositive ? 'Forecasts ran above' : 'Forecasts ran below'} delivered wind by an average of ${fmt(Math.abs(data.biasMw), 0)} MW. Use this as a planning signal alongside market and demand inputs.`}</span></div><div className="insight-arrow">{biasPositive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}</div></section>
        </> : <section className="month-view">
          {monthError && <div className="notice error-notice">{monthError}</div>}
          {monthLoading && <div className="chart-panel month-empty"><RefreshCw className="spin" size={19} /> Loading January summary…</div>}
          {!monthLoading && monthData && !monthData.dataAvailable && <div className="notice"><div className="notice-icon"><Cloud size={18} /></div><div><b>January dataset is not loaded yet</b><span>Load Elexon records to calculate monthly forecast accuracy. Empty intervals are counted as missing, never treated as zero error.</span></div><button onClick={sync} disabled={refreshing}>LOAD DATA <ArrowUpRight size={14} /></button></div>}
          {!monthLoading && monthData?.dataAvailable && <>
            <div className="month-heading"><div><div className="control-label"><span>02</span> MONTHLY PERFORMANCE</div><h2>January risk profile</h2><p>Point-in-time forecast accuracy across all delivery days · cutoff {monthData.cutoffUtc}</p></div><div className="coverage-pill"><span className="dot green" /> {monthData.coveragePct}% PAIR COVERAGE <small>{fmt(monthData.evaluatedPeriods)} / {fmt(monthData.expectedPeriods)}</small></div></div>
            <div className="metric-grid month-metrics">
              <article className="metric-card"><div className="metric-top"><span>MONTH AGGREGATE MAE</span><span className="metric-unit">ERROR</span></div><div className="metric-value">{fmt(monthData.overallMetrics.maeMw, 0)}<small> MW</small></div><div className="metric-foot"><span className="dot amber" />Across valid actual/forecast pairs</div></article>
              <article className="metric-card"><div className="metric-top"><span>MONTH AGGREGATE RMSE</span><span className="metric-unit">ERROR</span></div><div className="metric-value">{fmt(monthData.overallMetrics.rmseMw, 0)}<small> MW</small></div><div className="metric-foot"><span className="dot amber" />Penalizes larger forecast misses</div></article>
              <article className="metric-card"><div className="metric-top"><span>MONTH AGGREGATE WAPE</span><span className="metric-unit">WEIGHTED</span></div><div className="metric-value">{fmt(monthData.overallMetrics.wapePct, 1)}<small> %</small></div><div className="metric-foot"><span className="dot amber" />Absolute error / paired actuals</div></article>
              <article className="metric-card"><div className="metric-top"><span>SYSTEM BIAS</span><span className={`bias-chip ${(monthData.overallMetrics.biasMw || 0) >= 0 ? 'positive' : 'negative'}`}>{monthData.overallMetrics.biasMw == null ? 'NO DATA' : (monthData.overallMetrics.biasMw || 0) >= 0 ? 'OVER' : 'UNDER'}</span></div><div className="metric-value">{monthData.overallMetrics.biasMw == null ? '—' : `${monthData.overallMetrics.biasMw > 0 ? '+' : ''}${fmt(monthData.overallMetrics.biasMw, 0)}`}<small> MW</small></div><div className="metric-foot"><span className="dot blue" />Mean forecast − actual error</div></article>
            </div>
            <section className="chart-panel month-chart-panel">
              <div className="chart-header"><div><div className="control-label"><span>03</span> DAILY ERROR PROFILE</div><h2>Forecast error by delivery day</h2><p>Daily MAE and RMSE <i>·</i> MW per paired settlement period</p></div><div className="chart-tools"><div className="legend"><span><i className="legend-line actual" /> MAE</span><span><i className="legend-line forecast" /> RMSE</span></div></div></div>
              <div className="month-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthData.dailyBreakdown} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#263536" vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#78888a', fontSize: 10, fontFamily: 'DM Mono' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#78888a', fontSize: 10, fontFamily: 'DM Mono' }} width={44} />
                <Tooltip contentStyle={{ backgroundColor: '#182627', borderColor: '#3a4b4a', borderRadius: '5px', color: '#dce7e4', fontSize: 11 }} formatter={(value: number, name: string) => [`${fmt(value, 1)} MW`, name]} labelFormatter={day => `JAN ${String(day).padStart(2, '0')} · PAIRED ${monthData.dailyBreakdown[Number(day) - 1]?.pairedPeriods ?? 0}/48`} />
                <ReferenceLine y={0} stroke="#647473" strokeDasharray="3 4" />
                <Bar dataKey="maeMw" name="MAE" fill="#a5d47d" fillOpacity={0.78} maxBarSize={12} radius={[2, 2, 0, 0]} />
                <Bar dataKey="rmseMw" name="RMSE" fill="#62b6aa" fillOpacity={0.8} maxBarSize={12} radius={[2, 2, 0, 0]} />
              </BarChart></ResponsiveContainer></div>
              <div className="chart-footer"><span><i className="dot green" />ONLY VALID ACTUAL / FORECAST PAIRS</span><span><i className="dot amber" />MISSING PERIODS EXCLUDED FROM ERRORS</span><span>EXPECTED <b>1,488 PERIODS</b></span></div>
            </section>
            <section className="month-table-panel"><div className="table-heading"><div className="control-label"><span>04</span> DAILY COVERAGE & METRICS</div><span>LOW COVERAGE DAYS REMAIN VISIBLE</span></div><div className="month-table-wrap"><table><thead><tr><th>DAY</th><th>PAIRS</th><th>MISSING PAIRS</th><th>MAE MW</th><th>WAPE</th><th>BIAS MW</th><th>OUTTURN MWH</th></tr></thead><tbody>{monthData.dailyBreakdown.map(row => <tr key={row.date}><td>JAN {String(row.day).padStart(2, '0')}</td><td>{row.pairedPeriods}/48</td><td>{row.missingForecastPeriods + row.missingActualPeriods}</td><td>{fmt(row.maeMw, 1)}</td><td>{row.wapePct == null ? '—' : `${fmt(row.wapePct, 1)}%`}</td><td>{row.biasMw == null ? '—' : `${row.biasMw > 0 ? '+' : ''}${fmt(row.biasMw, 1)}`}</td><td>{fmt(row.actualTotalMwh, 0)}</td></tr>)}</tbody></table></div></section>
          </>}
        </section>}
        <footer><span>NORTHSTAR <b>WIND DESK</b> <i>·</i> PILOT ANALYTICS</span><span>MARKET TIME DISPLAYED IN UTC <i>·</i> SOURCE: ELEXON INSIGHTS API</span></footer>
      </div>
    </main>
  </div>
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as Point
  return <div className="chart-tooltip"><span className="tooltip-time">{label} UTC</span><div><i className="actual-dot" /> Actual <b>{fmt(p.actualMw, 0)} MW</b></div><div><i className="forecast-dot" /> Forecast <b>{fmt(p.forecastMw, 0)} MW</b></div><div><i className="gap-dot" /> Gap <b>{p.errorMw == null ? '—' : `${p.errorMw > 0 ? '+' : ''}${fmt(p.errorMw, 0)} MW`}</b></div>{p.publishTime && <small>Published {new Date(p.publishTime).toLocaleString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} UTC</small>}</div>
}
