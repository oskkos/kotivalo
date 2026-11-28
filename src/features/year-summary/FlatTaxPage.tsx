// A flat's form 7H page (Design canvas: Verot7H, Verot7HMuutos, Verot7HTyhja;
// openspec: year-summary, "The form 7H page of a flat"): the checks, the flat
// details form 7H asks for, rows 2.1–2.5 of the user's share with their
// parts, and what is not on form 7H. Each value has a copy button that
// copies it in the format MyTax takes (copy.ts).
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createLink } from '@tanstack/react-router'
import { useState } from 'react'
import { clientLog } from '#/lib/client-log'
import {
  formatDate,
  formatDayMonth,
  formatMoney,
  formatShare,
} from '#/lib/format'
import { m } from '#/paraglide/messages.js'
import { colors, radii } from '#/theme/tokens'
import { amountForCopy, shareForCopy } from './copy'
import { checkText } from './check-text'
import { personParam } from './holder'
import { flatRentalIncomeAfterCosts } from './estimate'
import { OriginalLabel } from './OriginalLabel'
import type { WithOriginal } from './original-text'
import { outsideTitleOriginal, partsText, rowOriginal } from './row-text'
import type { Check } from './summary'
import { ROW_NUMBERS } from './summary'
import type { FlatYearView } from './view'

type Ok = Extract<FlatYearView, { ok: true }>

interface Props {
  view: Ok
  /** Copies text to the clipboard; the browser's clipboard by default. */
  writeClipboard?: (text: string) => Promise<void>
}

const TextLink = createLink(Link)
const ButtonLink = createLink(Button)
const IconLink = createLink(IconButton)

const card = {
  bgcolor: 'background.paper',
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: `${String(radii.card)}px`,
} as const

function CopyIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8 V6 a2 2 0 0 0 -2 -2 H6 a2 2 0 0 0 -2 2 V14 a2 2 0 0 0 2 2 H8" />
    </svg>
  )
}

function CopyButton(props: { label: string; onCopy: () => void }) {
  return (
    <IconButton
      aria-label={props.label}
      onClick={props.onCopy}
      sx={{
        flexShrink: 0,
        width: 44,
        height: 44,
        border: `1.5px solid ${colors.inputBorder}`,
        bgcolor: 'background.paper',
      }}
    >
      <CopyIcon />
    </IconButton>
  )
}

/** One item to check, with its explanation and where to fix it. */
function CheckItem(props: { check: Check; view: Ok }) {
  const { check, view } = props
  const own = view.holder.kind === 'own'
  const propertyId = view.property.id
  const rentLink = (
    <TextLink
      to="/properties/$propertyId/rent"
      params={{ propertyId }}
      search={{ year: view.year }}
      sx={{ fontSize: 13, fontWeight: 900 }}
    >
      {m.flat_tax_check_open_rent()}
    </TextLink>
  )
  // A former owner has no flat pages to go to (openspec: year-summary).
  const link = view.former ? undefined : check.kind === 'unpaid' ||
    check.kind === 'partly_paid' ? (
    rentLink
  ) : check.kind === 'treatment_not_set' ? (
    <TextLink
      to="/properties/$propertyId/amounts"
      params={{ propertyId }}
      sx={{ fontSize: 13, fontWeight: 900 }}
    >
      {m.flat_tax_check_open_amounts()}
    </TextLink>
  ) : undefined
  const content = { ...checkText(check, { own }), link }
  return (
    <Stack component="li" direction="row" sx={{ gap: 1.25 }}>
      <Box sx={{ display: 'flex', pt: 0.125 }}>
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 7 V13 M12 17 V17.01" />
        </svg>
      </Box>
      <Stack sx={{ gap: 0.25, alignItems: 'flex-start' }}>
        <Typography component="h3" sx={{ fontSize: 14, fontWeight: 900 }}>
          {content.title}
        </Typography>
        <Typography
          sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}
          color="text.secondary"
        >
          {content.text}
        </Typography>
        {content.link}
      </Stack>
    </Stack>
  )
}

/** A row of the flat details: a value to copy, a plain text, or missing. */
function DetailRow(props: {
  label: string
  value: string | null
  /** Shown as plain text, without a copy button. */
  plain?: boolean
  /** The Finnish original of the label, shown after it. */
  original?: string | null
  /** Where a missing value is added. */
  addTo?: string
  onCopy: (value: string) => void
}) {
  const { label, value } = props
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        gap: 1,
        minHeight: 52,
        py: 0.5,
        borderTop: `1px solid ${colors.divider}`,
      }}
    >
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
        >
          {label}
          {props.original ? ` (${props.original})` : null}
        </Typography>
        {value === null ? (
          <Typography
            component="span"
            sx={{
              fontSize: 14,
              fontWeight: 800,
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            {m.flat_tax_missing()}
          </Typography>
        ) : (
          <Typography
            component="span"
            sx={
              props.plain
                ? { fontSize: 14, fontWeight: 700, color: 'text.secondary' }
                : { fontSize: 15, fontWeight: 900 }
            }
          >
            {value}
          </Typography>
        )}
      </Stack>
      {value === null && props.addTo ? (
        <ButtonLink
          to="/properties/$propertyId/edit"
          params={{ propertyId: props.addTo }}
          variant="contained"
          color="accent"
          aria-label={m.flat_tax_add_label({ detail: label })}
          sx={{ borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}
        >
          {m.flat_tax_add()}
        </ButtonLink>
      ) : null}
      {value !== null && !props.plain ? (
        <CopyButton
          label={m.flat_tax_copy({ label })}
          onCopy={() => {
            props.onCopy(value)
          }}
        />
      ) : null}
    </Stack>
  )
}

function OutsideRow(props: {
  label: WithOriginal
  text: string
  amount: number
}) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 48,
        py: 0.5,
        borderTop: `1px solid ${colors.divider}`,
      }}
    >
      <Stack>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 800 }}>
          <OriginalLabel label={props.label} />
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
        >
          {props.text}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' }}>
        {formatMoney(props.amount)}
      </Typography>
    </Stack>
  )
}

function BackIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  )
}

function kicker(holder: Ok['holder'], year: string): string {
  switch (holder.kind) {
    case 'own':
      return m.flat_tax_kicker({ year })
    case 'whole':
      return m.flat_tax_kicker_whole({ year })
    case 'person':
      return m.flat_tax_kicker_person({ year, name: holder.name })
  }
}

function noShareText(holder: Ok['holder'], year: string): string {
  switch (holder.kind) {
    case 'own':
      return m.flat_tax_no_share_text({ year })
    case 'whole':
      return m.flat_tax_no_share_whole_text({ year })
    case 'person':
      return m.flat_tax_no_share_person_text({ name: holder.name, year })
  }
}

const OwnerLink = createLink(ButtonBase)

/** The whole flat's owners, each opening their own form 7H page. */
function OwnersCard(props: { view: Ok }) {
  const { view } = props
  return (
    <Stack
      component="section"
      aria-labelledby="flat-tax-owners"
      sx={{ ...card, px: 2, py: 0.75 }}
    >
      <Typography
        id="flat-tax-owners"
        component="h2"
        sx={{ fontSize: 15, fontWeight: 900, my: 0.75 }}
      >
        {m.flat_tax_owners()}
      </Typography>
      <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {view.owners.map((owner) => (
          <li key={owner.userId}>
            <OwnerLink
              to="/year-summary/$propertyId"
              params={{ propertyId: view.property.id }}
              search={{
                year: view.year,
                person: owner.isYou ? undefined : owner.userId,
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
                minHeight: 56,
                py: 0.75,
                textAlign: 'left',
                fontFamily: 'inherit',
                borderTop: `1px solid ${colors.divider}`,
              }}
            >
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  component="span"
                  sx={{ fontSize: 14, fontWeight: 900 }}
                >
                  {owner.name}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'text.secondary',
                  }}
                >
                  {m.year_summary_share_person({
                    share: formatShare(owner.share),
                  })}
                </Typography>
              </Stack>
              <Typography
                component="span"
                sx={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' }}
              >
                {formatMoney(owner.income)}
              </Typography>
              <Box sx={{ display: 'flex', color: 'text.secondary' }}>
                <ChevronIcon />
              </Box>
            </OwnerLink>
          </li>
        ))}
      </Stack>
    </Stack>
  )
}

function ChevronIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5 L16 12 L9 19" />
    </svg>
  )
}

const browserClipboard = (text: string) => navigator.clipboard.writeText(text)

export function FlatTaxPage(props: Props) {
  const { view } = props
  const writeClipboard = props.writeClipboard ?? browserClipboard
  const [notice, setNotice] = useState<string | undefined>()
  const year = String(view.year)
  const flat = view.flat
  const { holder } = view
  const person = personParam(holder)
  const whole = holder.kind === 'whole'
  const identityCode = outsideTitleOriginal.identity_code()

  const copy = (value: string) => {
    // Outside a secure context navigator.clipboard is undefined and the
    // write throws at once; the promise turns that into the failure too.
    new Promise<void>((resolve) => {
      resolve(writeClipboard(value))
    }).then(
      () => {
        setNotice(m.flat_tax_copied({ value }))
      },
      () => {
        // The value is never logged: it may be a name or an amount.
        clientLog.warn('year_summary.copy_failed')
        setNotice(m.flat_tax_copy_failed())
      },
    )
  }

  const tenant =
    flat?.details.tenant.kind === 'one'
      ? flat.details.tenant.name
      : flat?.details.tenant.kind === 'several'
        ? m.flat_tax_tenant_several()
        : null
  const period = flat?.details.period
    ? m.flat_tax_period_value({
        from: formatDayMonth(flat.details.period.from),
        to: formatDate(flat.details.period.to),
      })
    : null

  return (
    <Stack sx={{ minHeight: '100dvh' }}>
      <Stack
        component="header"
        direction="row"
        sx={{ alignItems: 'center', gap: 0.5, px: 1.5, pt: 2, pb: 0.5 }}
      >
        <IconLink
          to="/year-summary"
          search={{ year: view.year, person }}
          aria-label={m.flat_tax_back()}
        >
          <BackIcon />
        </IconLink>
        <Stack sx={{ minWidth: 0 }}>
          <Typography
            component="span"
            sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary' }}
          >
            {kicker(holder, year)}
          </Typography>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontSize: 22, letterSpacing: '-0.02em' }}
          >
            {view.property.streetAddress}
          </Typography>
        </Stack>
      </Stack>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.5, px: 2.5, pt: 0.75, pb: 3 }}
      >
        {flat === null ? (
          <Stack
            component="section"
            aria-labelledby="flat-tax-no-share"
            sx={{ ...card, px: 2.75, py: 3.5, gap: 1, textAlign: 'center' }}
          >
            <Typography
              id="flat-tax-no-share"
              component="h2"
              sx={{ fontSize: 19, fontWeight: 900 }}
            >
              {m.flat_tax_no_share_title({ year })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {noShareText(holder, year)}
            </Typography>
          </Stack>
        ) : (
          <>
            {view.former ? (
              <Stack
                component="section"
                role="note"
                sx={{
                  bgcolor: colors.lavenderTint,
                  borderRadius: `${String(radii.tile)}px`,
                  px: 1.75,
                  py: 1.5,
                  gap: 0.25,
                }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: 13, fontWeight: 900 }}
                >
                  {m.flat_tax_band_former_title()}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}
                >
                  {m.flat_tax_band_former_text()}
                </Typography>
              </Stack>
            ) : null}
            {holder.kind === 'own' ? null : (
              <Stack
                component="section"
                role="note"
                sx={{
                  bgcolor: colors.lavenderTint,
                  borderRadius: `${String(radii.tile)}px`,
                  px: 1.75,
                  py: 1.5,
                  gap: 0.25,
                }}
              >
                <Typography
                  component="span"
                  sx={{ fontSize: 13, fontWeight: 900 }}
                >
                  {holder.kind === 'whole'
                    ? m.flat_tax_band_whole_title()
                    : m.flat_tax_band_person_title({ name: holder.name })}
                </Typography>
                <Typography
                  component="span"
                  sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}
                >
                  {whole
                    ? m.flat_tax_band_whole_text()
                    : m.flat_tax_band_person_text()}
                </Typography>
              </Stack>
            )}
            {flat.checks.length > 0 ? (
              <Box
                component="section"
                aria-labelledby="flat-tax-checks"
                sx={{
                  bgcolor: colors.yellowTint,
                  borderRadius: `${String(radii.menu)}px`,
                  px: 1.75,
                  py: 1.5,
                }}
              >
                <Typography
                  id="flat-tax-checks"
                  component="h2"
                  // Visually hidden. In sx a width of 1 is 100 %, which
                  // made the page scroll sideways: the sizes are in pixels.
                  sx={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    m: '-1px',
                    p: 0,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.flat_tax_checks()}
                </Typography>
                <Stack
                  component="ul"
                  sx={{ m: 0, p: 0, listStyle: 'none', gap: 1.5 }}
                >
                  {flat.checks.map((check) => (
                    <CheckItem
                      key={`${check.kind}-${'on' in check ? check.on : ''}`}
                      check={check}
                      view={view}
                    />
                  ))}
                </Stack>
              </Box>
            ) : null}
            {whole ? (
              <OwnersCard view={view} />
            ) : (
              <Stack
                component="section"
                aria-labelledby="flat-tax-details"
                sx={{ ...card, pl: 2, pr: 1.5, py: 0.75 }}
              >
                <Typography
                  id="flat-tax-details"
                  component="h2"
                  sx={{ fontSize: 15, fontWeight: 900, my: 0.75 }}
                >
                  {m.flat_tax_details()}
                </Typography>
                <DetailRow
                  label={m.flat_tax_housing_company_name()}
                  value={flat.details.name}
                  addTo={view.former ? undefined : view.property.id}
                  onCopy={copy}
                />
                <DetailRow
                  label={m.flat_tax_business_id()}
                  value={flat.details.businessId}
                  addTo={view.former ? undefined : view.property.id}
                  onCopy={copy}
                />
                <DetailRow
                  label={m.flat_tax_apartment_number()}
                  value={flat.details.apartmentNumber}
                  addTo={view.former ? undefined : view.property.id}
                  onCopy={copy}
                />
                <DetailRow
                  label={m.flat_tax_tenant()}
                  value={tenant ?? m.flat_tax_tenant_none({ year })}
                  plain={tenant === null}
                  onCopy={copy}
                />
                <DetailRow
                  label={identityCode.text}
                  original={identityCode.original}
                  value={m.flat_tax_identity_code_text()}
                  plain
                  onCopy={copy}
                />
                {period === null ? null : (
                  <DetailRow
                    label={m.flat_tax_period()}
                    value={period}
                    onCopy={copy}
                  />
                )}
                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    gap: 1,
                    minHeight: 52,
                    py: 0.5,
                    borderTop: `1px solid ${colors.divider}`,
                  }}
                >
                  <Stack sx={{ flex: 1 }}>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: 'text.secondary',
                      }}
                    >
                      {m.flat_tax_share()}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ fontSize: 15, fontWeight: 900 }}
                    >
                      {formatShare(flat.details.share)}
                    </Typography>
                  </Stack>
                  <CopyButton
                    label={m.flat_tax_copy({ label: m.flat_tax_share() })}
                    onCopy={() => {
                      copy(shareForCopy(flat.details.share))
                    }}
                  />
                </Stack>
              </Stack>
            )}
            <Stack
              component="section"
              aria-labelledby="flat-tax-rows"
              sx={{ ...card, pl: 2, pr: 1.5, py: 0.75 }}
            >
              <Stack
                direction="row"
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  my: 0.75,
                }}
              >
                <Typography
                  id="flat-tax-rows"
                  component="h2"
                  sx={{ fontSize: 15, fontWeight: 900 }}
                >
                  {m.flat_tax_rows()}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    bgcolor: colors.yellowTint,
                    borderRadius: 999,
                    px: 1.25,
                    py: 0.375,
                    fontSize: 12,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.flat_tax_rows_share({
                    share: formatShare(flat.details.share),
                  })}
                </Typography>
              </Stack>
              {ROW_NUMBERS.map((number) => {
                const row = flat.rows[number]
                return (
                  <Stack
                    key={number}
                    direction="row"
                    data-row={number}
                    sx={{
                      alignItems: 'center',
                      gap: 1,
                      minHeight: 56,
                      py: 0.75,
                      borderTop: `1px solid ${colors.divider}`,
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{
                        width: 34,
                        flexShrink: 0,
                        fontSize: 13,
                        fontWeight: 900,
                        color: 'text.secondary',
                      }}
                    >
                      {number}
                    </Typography>
                    <Stack sx={{ flex: 1, minWidth: 0, gap: 0.125 }}>
                      <Typography
                        component="h3"
                        sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}
                      >
                        <OriginalLabel label={rowOriginal(number)} />
                      </Typography>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'text.secondary',
                          lineHeight: 1.3,
                        }}
                      >
                        {row.parts.length > 0
                          ? partsText(row.parts)
                          : m.flat_tax_no_parts()}
                      </Typography>
                      {number === '2.3' && row.cents > 0 ? (
                        <Typography
                          component="span"
                          sx={{
                            mt: 0.5,
                            fontSize: 12,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            bgcolor: colors.lavenderTint,
                            borderRadius: '10px',
                            px: 1,
                            py: 0.75,
                          }}
                        >
                          {m.flat_tax_case_law()}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 15,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatMoney(row.cents)}
                    </Typography>
                    {whole ? null : (
                      <CopyButton
                        label={m.flat_tax_copy_row({ row: number })}
                        onCopy={() => {
                          copy(amountForCopy(row.cents))
                        }}
                      />
                    )}
                  </Stack>
                )
              })}
              {whole ? null : (
                <Stack
                  direction="row"
                  data-row="net"
                  sx={{
                    alignItems: 'center',
                    gap: 1,
                    minHeight: 56,
                    py: 0.75,
                    borderTop: `2px solid ${colors.divider}`,
                  }}
                >
                  <Stack sx={{ flex: 1, minWidth: 0, gap: 0.125 }}>
                    <Typography
                      component="h3"
                      sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}
                    >
                      {m.flat_tax_net()}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'text.secondary',
                      }}
                    >
                      {m.flat_tax_net_note()}
                    </Typography>
                  </Stack>
                  <Typography
                    component="span"
                    sx={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap' }}
                  >
                    {formatMoney(flatRentalIncomeAfterCosts(flat.rows))}
                  </Typography>
                </Stack>
              )}
            </Stack>
            {flat.outside.capitalised > 0 ||
            flat.outside.improvements > 0 ||
            flat.outside.depositDamage > 0 ? (
              <Stack
                component="section"
                aria-labelledby="flat-tax-outside"
                sx={{ ...card, px: 2, py: 0.75 }}
              >
                <Typography
                  id="flat-tax-outside"
                  component="h2"
                  sx={{ fontSize: 15, fontWeight: 900, my: 0.75 }}
                >
                  {m.flat_tax_outside()}
                </Typography>
                {flat.outside.capitalised > 0 ? (
                  <OutsideRow
                    label={outsideTitleOriginal.capitalised()}
                    text={m.flat_tax_outside_capitalised_text()}
                    amount={flat.outside.capitalised}
                  />
                ) : null}
                {flat.outside.improvements > 0 ? (
                  <OutsideRow
                    label={outsideTitleOriginal.improvements()}
                    text={m.flat_tax_outside_improvements_text()}
                    amount={flat.outside.improvements}
                  />
                ) : null}
                {flat.outside.depositDamage > 0 ? (
                  <OutsideRow
                    label={outsideTitleOriginal.deposit_damage()}
                    text={m.flat_tax_outside_deposit_damage_text()}
                    amount={flat.outside.depositDamage}
                  />
                ) : null}
              </Stack>
            ) : null}
            <Typography
              sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}
              color="text.secondary"
            >
              {m.flat_tax_note()}
            </Typography>
          </>
        )}
      </Stack>
      <Snackbar
        open={notice !== undefined}
        autoHideDuration={4000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') {
            setNotice(undefined)
          }
        }}
        message={notice}
        slotProps={{
          content: {
            role: 'status',
            sx: { bgcolor: 'primary.main', color: 'primary.contrastText' },
          },
        }}
      />
    </Stack>
  )
}
