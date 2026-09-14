"use client";

import { clsx } from "clsx";
import { RULE_PRESETS, type DrawdownMode, type PropRules } from "@/lib/mnq/propRules";
import type { ScanOptions } from "@/lib/mnq/setups";
import { formatEtMinute } from "@/lib/mnq/sessions";

interface RulesPanelProps {
  rules: PropRules;
  onRulesChange: (rules: PropRules) => void;
  options: ScanOptions;
  onOptionsChange: (patch: Partial<ScanOptions>) => void;
  onReset: () => void;
}

const MODE_LABEL: Record<DrawdownMode, string> = {
  "trailing-intraday": "Trailing · intraday (unrealised)",
  "trailing-eod": "Trailing · end of day",
  static: "Static",
};

export function RulesPanel({ rules, onRulesChange, options, onOptionsChange, onReset }: RulesPanelProps) {
  const patch = (next: Partial<PropRules>) => onRulesChange({ ...rules, ...next });

  return (
    <section className="glass-panel space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-sm tracking-wide text-white/80">Rules &amp; scanner</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/50 transition-colors hover:border-white/25 hover:text-white/80"
        >
          Reset account
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {RULE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onRulesChange(preset)}
            className={clsx(
              "rounded-lg border px-2.5 py-1 text-[11px] transition-colors",
              preset.id === rules.id
                ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                : "border-white/10 text-white/50 hover:border-white/25 hover:text-white/80",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Drawdown mode</span>
        <select
          value={rules.drawdown.mode}
          onChange={(event) =>
            patch({ drawdown: { ...rules.drawdown, mode: event.target.value as DrawdownMode } })
          }
          className="w-full rounded-lg border border-white/10 bg-base-850 px-2.5 py-1.5 font-mono text-[11px] text-white/85 outline-none focus:border-violet-400/50"
        >
          {(Object.keys(MODE_LABEL) as DrawdownMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {MODE_LABEL[mode]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Account size"
          value={rules.accountSize}
          step={1000}
          onChange={(accountSize) => patch({ accountSize })}
        />
        <NumberField
          label="Drawdown $"
          value={rules.drawdown.amount}
          step={100}
          onChange={(amount) => patch({ drawdown: { ...rules.drawdown, amount } })}
        />
        <NumberField
          label="Daily loss $"
          value={rules.dailyLossLimit ?? 0}
          step={100}
          onChange={(value) => patch({ dailyLossLimit: value > 0 ? value : null })}
          hint="0 = none"
        />
        <NumberField
          label="Max contracts"
          value={rules.maxContracts}
          step={1}
          onChange={(maxContracts) => patch({ maxContracts })}
        />
        <NumberField
          label="Consistency %"
          value={rules.consistencyPct === null ? 0 : Math.round(rules.consistencyPct * 100)}
          step={5}
          onChange={(value) => patch({ consistencyPct: value > 0 ? value / 100 : null })}
          hint="0 = none"
        />
        <NumberField
          label="Flatten (ET min)"
          value={rules.flattenAtMinute}
          step={5}
          onChange={(flattenAtMinute) => patch({ flattenAtMinute })}
          hint={formatEtMinute(rules.flattenAtMinute)}
        />
      </div>

      <div className="space-y-3 border-t border-white/8 pt-3">
        <Slider
          label="Min score"
          value={options.minScore}
          min={0}
          max={100}
          step={5}
          onChange={(minScore) => onOptionsChange({ minScore })}
        />
        <Slider
          label="Min R:R"
          value={options.minRr}
          min={1}
          max={5}
          step={0.25}
          format={(v) => `${v.toFixed(2)}R`}
          onChange={(minRr) => onOptionsChange({ minRr })}
        />
        <Slider
          label="Min stop"
          value={options.minStopPoints}
          min={1}
          max={30}
          step={1}
          format={(v) => `${v} pt`}
          onChange={(minStopPoints) => onOptionsChange({ minStopPoints })}
        />

        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-[11px] text-white/60">Killzones only</span>
          <input
            type="checkbox"
            checked={options.killzonesOnly}
            onChange={(event) => onOptionsChange({ killzonesOnly: event.target.checked })}
            className="h-4 w-4 accent-violet-500"
          />
        </label>
      </div>

      <p className="border-t border-white/8 pt-3 text-[10px] leading-relaxed text-white/35">
        Presets are templates, not quoted terms. Firms change limits and trailing modes without notice — read your
        account dashboard and set these to match before trusting any sizing shown here.
      </p>
    </section>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wider text-white/40">
        {label}
        {hint && <span className="font-mono normal-case text-white/25">{hint}</span>}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-white/10 bg-base-850 px-2.5 py-1.5 font-mono text-[11px] text-white/85 outline-none focus:border-violet-400/50"
      />
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[11px] text-white/60">
        {label}
        <span className="font-mono text-[10px] text-white/40">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-violet-500"
      />
    </label>
  );
}
