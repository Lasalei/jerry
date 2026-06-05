import { useMemo, useRef } from 'react'
import { useStore } from '../store'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { Card, ScreenHeader } from '../components/ui'
import { exportJSON, exportSalesCSV, parseImport } from '../lib/exporters'
import { computeStats } from '../lib/stats'
import { formatKr } from '../lib/format'
import { isRemote } from '../lib/db'

function ActionRow({
  title,
  subtitle,
  onClick,
}: {
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 p-4 text-left active:bg-canvas"
    >
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-muted">{subtitle}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 shrink-0 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-lg font-semibold tnum text-ink">{value}</span>
    </div>
  )
}

export function Mer({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, importData } = useStore()
  const config = data.config
  const confirm = useConfirm()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const stats = useMemo(() => computeStats(data), [data])

  function handleExportJSON() {
    exportJSON(data)
    toast('JSON-backup lastet ned')
  }

  function handleExportCSV() {
    if (data.transactions.length === 0) {
      toast('Ingen salg å eksportere', 'error')
      return
    }
    exportSalesCSV(data)
    toast('CSV lastet ned')
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      const snapshot = parseImport(text)
      const ok = await confirm({
        title: 'Importere data?',
        message: `Dette erstatter ALT som ligger her nå med ${snapshot.styles.length} stiler og ${snapshot.transactions.length} oppføringer.`,
        confirmLabel: 'Importer',
        danger: true,
      })
      if (ok) {
        await importData(snapshot)
        toast('Data importert')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kunne ikke lese filen', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-lg pb-4">
      <ScreenHeader title="Mer" />

      <div className="space-y-4 px-4">
        {/* Stats */}
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Statistikk
          </h2>
          <Card className="divide-y divide-line">
            <StatLine label="Solgte enheter" value={stats.totalSold} />
            <StatLine label="Total omsetning" value={formatKr(stats.totalRevenue)} />
            <StatLine
              label={`Mest solgt ${config.field1.name.toLowerCase()}`}
              value={stats.topVariant}
            />
            {config.field2 && (
              <StatLine
                label={`Mest solgt ${config.field2.name.toLowerCase()}`}
                value={stats.topSize}
              />
            )}
            <StatLine label="Gitt bort" value={stats.giftCount} />
          </Card>
        </div>

        {/* Settings */}
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Oppsett
          </h2>
          <Card>
            <ActionRow
              title="Innstillinger"
              subtitle="Produktnavn og felter"
              onClick={onOpenSettings}
            />
          </Card>
        </div>

        {/* Backup */}
        <div>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Sikkerhetskopi
          </h2>
          <Card className="divide-y divide-line">
            <ActionRow
              title="Eksporter JSON"
              subtitle="Full backup av alle data"
              onClick={handleExportJSON}
            />
            <ActionRow
              title="Eksporter CSV"
              subtitle="Salg til Excel (semikolon)"
              onClick={handleExportCSV}
            />
            <ActionRow
              title="Importer JSON"
              subtitle="Erstatter alle data"
              onClick={() => fileRef.current?.click()}
            />
          </Card>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <p className="px-1 text-center text-xs text-muted">
          {isRemote ? (
            <>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-kit align-middle" />
              Draktlager · synkronisert live (Supabase)
            </>
          ) : (
            'Draktlager · lagrer lokalt på denne enheten'
          )}
        </p>
      </div>
    </div>
  )
}
