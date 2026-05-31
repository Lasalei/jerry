import { useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../components/Toast'
import { StylePicker } from '../components/StylePicker'
import { QtyStepper } from '../components/QtyStepper'
import {
  Card,
  Field,
  NativeSelect,
  PrimaryButton,
  ScreenHeader,
  controlClass,
} from '../components/ui'
import { CARRIERS, CHANNELS, PAYMENTS, SIZES, VARIANTS } from '../lib/constants'
import { formatKr, todayISO } from '../lib/format'
import type {
  Carrier,
  Channel,
  DraftItem,
  Payment,
  Size,
  TransactionItem,
  TxType,
  Variant,
} from '../lib/types'

const NO_SHIPPING = 'Ingen frakt'

function emptyItem(): DraftItem {
  return { styleId: '', variant: '', size: '', qty: 1, price: 0 }
}

export function NyttSalg() {
  const { data, available, styleTotal, addTransaction } = useStore()
  const toast = useToast()

  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState<TxType>('salg')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [buyer, setBuyer] = useState('')
  const [channel, setChannel] = useState<Channel>('Finn')
  const [payment, setPayment] = useState<Payment>('Vipps')
  // '' represents "Ingen frakt" (no shipping).
  const [carrier, setCarrier] = useState<Carrier | ''>('')
  const [trackingCode, setTrackingCode] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const isGift = type === 'gitt_bort'

  function patchItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    )
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Available qty for a draft item (needs style + variant + size).
  function availFor(it: DraftItem): number | null {
    if (!it.styleId || !it.variant || !it.size) return null
    return available(it.styleId, it.variant as Variant, it.size as Size)
  }

  function itemComplete(it: DraftItem): boolean {
    return Boolean(it.styleId && it.variant && it.size && it.qty > 0)
  }

  function itemOverStock(it: DraftItem): boolean {
    const a = availFor(it)
    return a !== null && it.qty > a
  }

  const completeItems = items.filter(itemComplete)
  const anyOverStock = items.some(itemOverStock)
  const total = isGift
    ? 0
    : completeItems.reduce((sum, it) => sum + it.price * it.qty, 0)

  const canSave = completeItems.length > 0 && !anyOverStock && !saving

  function reset() {
    setDate(todayISO())
    setType('salg')
    setItems([emptyItem()])
    setBuyer('')
    setCarrier('')
    setTrackingCode('')
    setNote('')
    // keep channel + payment as-is for fast repeat logging
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const txItems: TransactionItem[] = completeItems.map((it) => {
        const style = data.styles.find((s) => s.id === it.styleId)
        return {
          styleId: it.styleId,
          styleName: style?.name ?? '(slettet stil)',
          variant: it.variant as Variant,
          size: it.size as Size,
          qty: it.qty,
          price: isGift ? 0 : it.price,
        }
      })
      await addTransaction({
        date,
        type,
        buyer,
        channel,
        payment,
        carrier: carrier || null,
        trackingCode,
        note,
        items: txItems,
      })
      reset()
      toast(isGift ? 'Registrert som gitt bort' : `Salg lagret · ${formatKr(total)}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Noe gikk galt', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasStyles = data.styles.length > 0

  return (
    <div className="mx-auto max-w-lg pb-4">
      <ScreenHeader title="Nytt salg" />

      <div className="space-y-3 px-4">
        {/* Date + type toggle */}
        <Card className="p-4">
          <div className="flex gap-3">
            <Field label="Dato" className="flex-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Type" className="flex-1">
              <div className="flex rounded-xl border border-line p-1">
                <button
                  type="button"
                  onClick={() => setType('salg')}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    !isGift ? 'bg-kit text-white' : 'text-muted'
                  }`}
                >
                  Salg
                </button>
                <button
                  type="button"
                  onClick={() => setType('gitt_bort')}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    isGift ? 'bg-kit text-white' : 'text-muted'
                  }`}
                >
                  Gitt bort
                </button>
              </div>
            </Field>
          </div>
        </Card>

        {!hasStyles && (
          <Card className="p-4 text-sm text-muted">
            Du har ingen stiler ennå. Gå til <strong>Lager</strong> og legg til en
            stil først.
          </Card>
        )}

        {/* Item rows */}
        {items.map((it, index) => {
          const avail = availFor(it)
          const over = itemOverStock(it)
          return (
            <Card key={index} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Vare {index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-sm font-semibold text-danger"
                  >
                    Fjern
                  </button>
                )}
              </div>

              <Field label="Stil">
                <StylePicker
                  styles={data.styles}
                  value={it.styleId}
                  styleTotal={styleTotal}
                  onChange={(id) => patchItem(index, { styleId: id })}
                />
              </Field>

              <div className="flex gap-3">
                <Field label="Variant" className="flex-1">
                  <NativeSelect
                    value={it.variant}
                    onChange={(e) =>
                      patchItem(index, { variant: e.target.value as Variant })
                    }
                  >
                    <option value="">Velg…</option>
                    {VARIANTS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Størrelse" className="w-32">
                  <NativeSelect
                    value={it.size}
                    onChange={(e) =>
                      patchItem(index, { size: e.target.value as Size })
                    }
                  >
                    <option value="">Velg…</option>
                    {SIZES.map((s) => {
                      const q =
                        it.styleId && it.variant
                          ? available(it.styleId, it.variant as Variant, s)
                          : null
                      return (
                        <option key={s} value={s}>
                          {s}
                          {q !== null ? ` (${q})` : ''}
                        </option>
                      )
                    })}
                  </NativeSelect>
                </Field>
              </div>

              <div className={`flex gap-3 ${isGift ? '' : 'items-end'}`}>
                <Field label="Antall" className="flex-1">
                  <QtyStepper
                    value={it.qty}
                    onChange={(v) => patchItem(index, { qty: v })}
                    min={1}
                  />
                </Field>
                {!isGift && (
                  <Field label="Pris (kr)" className="flex-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.price === 0 ? '' : it.price}
                      placeholder="0"
                      onChange={(e) =>
                        patchItem(index, { price: Number(e.target.value) || 0 })
                      }
                      className={`${controlClass} tnum`}
                    />
                  </Field>
                )}
              </div>

              {avail !== null && (
                <p className={`text-xs ${over ? 'text-danger' : 'text-muted'}`}>
                  {over
                    ? `Kun ${avail} på lager`
                    : `${avail} på lager`}
                </p>
              )}
            </Card>
          )
        })}

        <button
          type="button"
          onClick={addItem}
          disabled={!hasStyles}
          className="w-full rounded-xl border border-dashed border-kit px-4 py-3 font-semibold text-kit disabled:opacity-40"
        >
          + Legg til vare
        </button>

        {/* Buyer / channel / payment / note */}
        <Card className="space-y-3 p-4">
          <Field label="Kjøper">
            <input
              type="text"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              placeholder="Navn eller kallenavn"
              className={controlClass}
            />
          </Field>
          <div className="flex gap-3">
            <Field label="Kanal" className="flex-1">
              <NativeSelect
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {!isGift && (
              <Field label="Betaling" className="flex-1">
                <NativeSelect
                  value={payment}
                  onChange={(e) => setPayment(e.target.value as Payment)}
                >
                  {PAYMENTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </div>

          {/* Shipping (frakt) */}
          <div className="flex gap-3">
            <Field label="Frakt" className="flex-1">
              <NativeSelect
                value={carrier}
                onChange={(e) => setCarrier(e.target.value as Carrier | '')}
              >
                <option value="">{NO_SHIPPING}</option>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {carrier && (
              <Field label="Sporingskode" className="flex-1">
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="f.eks. CC123…"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`${controlClass} tnum`}
                />
              </Field>
            )}
          </div>

          <Field label="Notat">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Valgfritt"
              className={controlClass}
            />
          </Field>
        </Card>

        {/* Running total + save */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted">
            Totalt
          </span>
          <span className="font-display text-3xl font-bold tnum text-ink">
            {formatKr(total)}
          </span>
        </div>

        <PrimaryButton onClick={handleSave} disabled={!canSave}>
          {isGift ? 'Lagre' : 'Lagre salg'}
        </PrimaryButton>
      </div>
    </div>
  )
}
