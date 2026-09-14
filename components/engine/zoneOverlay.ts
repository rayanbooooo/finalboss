import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

/**
 * Canvas overlay that shades fair value gaps and order blocks on the chart.
 *
 * lightweight-charts has no rectangle API, and the alternatives are worse: a
 * pair of price lines per zone spans the entire chart width and says nothing
 * about when the zone formed, and absolutely-positioned DOM elements drift out
 * of alignment the moment the user pans. A series primitive draws into the
 * chart's own canvas with the chart's own coordinate system, so zones stay
 * pinned to their bars through pan, zoom and resize.
 */

export interface ChartZone {
  /** Bar time the zone formed on. */
  startTime: UTCTimestamp;
  /** Bar time the zone was mitigated on, or null to extend to the right edge. */
  endTime: UTCTimestamp | null;
  low: number;
  high: number;
  fill: string;
  border: string;
  label?: string;
}

class ZonePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly zones: ChartZone[],
    private readonly chart: IChartApi | null,
    private readonly series: ISeriesApi<SeriesType> | null,
  ) {}

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]): void {
    const { chart, series } = this;
    if (!chart || !series || this.zones.length === 0) return;

    const timeScale = chart.timeScale();

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const xRatio = scope.horizontalPixelRatio;
      const yRatio = scope.verticalPixelRatio;

      for (const zone of this.zones) {
        const yHigh = series.priceToCoordinate(zone.high);
        const yLow = series.priceToCoordinate(zone.low);
        const xStart = timeScale.timeToCoordinate(zone.startTime as Time);
        if (yHigh === null || yLow === null || xStart === null) continue;

        // An unmitigated zone extends to the right edge: it is still live.
        const xEndRaw = zone.endTime === null ? scope.mediaSize.width : timeScale.timeToCoordinate(zone.endTime as Time);
        const xEnd = xEndRaw === null ? scope.mediaSize.width : xEndRaw;

        const left = Math.round(Math.min(xStart, xEnd) * xRatio);
        const right = Math.round(Math.max(xStart, xEnd) * xRatio);
        const top = Math.round(Math.min(yHigh, yLow) * yRatio);
        const bottom = Math.round(Math.max(yHigh, yLow) * yRatio);

        // Sub-pixel zones would otherwise vanish entirely when zoomed out.
        const width = Math.max(right - left, Math.round(xRatio));
        const height = Math.max(bottom - top, Math.round(yRatio));

        ctx.fillStyle = zone.fill;
        ctx.fillRect(left, top, width, height);

        ctx.strokeStyle = zone.border;
        ctx.lineWidth = Math.max(1, Math.round(xRatio));
        ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
      }
    });
  }
}

class ZonePaneView implements IPrimitivePaneView {
  constructor(private readonly source: ZoneOverlay) {}

  zOrder() {
    // Behind the candles: a zone that obscures the price action it explains is
    // worse than no zone at all.
    return "bottom" as const;
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new ZonePaneRenderer(this.source.zones, this.source.chart, this.source.series);
  }
}

export class ZoneOverlay implements ISeriesPrimitive<Time> {
  zones: ChartZone[] = [];
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;

  private readonly paneView = new ZonePaneView(this);
  private requestUpdate?: () => void;

  attached(param: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = undefined;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  setZones(zones: ChartZone[]): void {
    this.zones = zones;
    this.requestUpdate?.();
  }
}
