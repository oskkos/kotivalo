// The new flat and edit flat form (Design canvas: "Uusi asunto"): the
// address and flat sections. Owners, rent and the tenant come with their
// own features.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm } from '@tanstack/react-form'
import { useState, type ReactNode } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { ChoiceField } from '#/components/form/ChoiceField'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import type { AlertReason } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { colors } from '#/theme/tokens'
import { ROOM_COUNTS } from './property'
import { roomCountLabel } from './room-count'
import { newPropertyInput, type NewPropertyInput } from './schemas'

export const EMPTY_PROPERTY: NewPropertyInput = {
  streetAddress: '',
  postcode: '',
  city: '',
  roomCount: 0,
  floorArea: '',
  housingCompanyName: '',
  businessId: '',
  apartmentNumber: '',
}

export type SaveResult = { ok: true } | { ok: false; reason: AlertReason }

interface Props {
  title: string
  /** With `ownedSince`, the form asks for it (new flats only). */
  initial: NewPropertyInput
  /** Gets the details as typed; the server function parses them again. */
  save: (details: NewPropertyInput) => Promise<SaveResult>
  onSaved: () => void
  onClose: () => void
  /** Icon buttons at the right of the header, e.g. to Sharing. */
  headerAction?: ReactNode
  /** Shown above the form's sections, e.g. the tenancy card. */
  aboveForm?: ReactNode
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Stack component="section" sx={{ gap: 1.25 }}>
      <Typography variant="h4" component="h2" sx={{ fontWeight: 900 }}>
        {props.title}
      </Typography>
      {props.children}
    </Stack>
  )
}

export function PropertyForm({
  title,
  initial,
  save,
  onSaved,
  onClose,
  headerAction,
  aboveForm,
}: Props) {
  const [alert, setAlert] = useState<AlertReason>()
  const form = useForm({
    defaultValues: initial,
    // `ownedSince` is optional, so the same schema checks the edit form.
    validators: { onChange: newPropertyInput },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      try {
        const result = await save(value)
        if (result.ok) {
          onSaved()
        } else {
          setAlert(result.reason)
        }
      } catch (error) {
        clientLog.error('property.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      sx={{ minHeight: '100dvh' }}
    >
      <Box
        component="header"
        sx={{
          display: 'grid',
          // Equal sides keep the title centred with one or two actions.
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <IconButton
          aria-label={m.property_close()}
          onClick={onClose}
          sx={{ justifySelf: 'start' }}
        >
          <CloseIcon />
        </IconButton>
        <Typography
          variant="h3"
          component="h1"
          sx={{ textAlign: 'center', fontSize: 18 }}
        >
          {title}
        </Typography>
        <Box sx={{ justifySelf: 'end', display: 'flex', gap: 0.5 }}>
          {headerAction}
        </Box>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 2.25, px: 2.5, pt: 1, pb: 2.5 }}
      >
        {aboveForm}
        <Section title={m.property_section_address()}>
          <form.Field name="streetAddress">
            {(field) => (
              <TextField
                field={field}
                label={m.property_street_address()}
                placeholder={m.property_street_address_placeholder()}
                autoComplete="street-address"
                fullWidth
              />
            )}
          </form.Field>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '120px minmax(0, 1fr)',
              gap: 1.25,
            }}
          >
            <form.Field name="postcode">
              {(field) => (
                <TextField
                  field={field}
                  label={m.property_postcode()}
                  autoComplete="postal-code"
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
              )}
            </form.Field>
            <form.Field name="city">
              {(field) => (
                <TextField
                  field={field}
                  label={m.property_city()}
                  autoComplete="address-level2"
                />
              )}
            </form.Field>
          </Box>
        </Section>
        <Section title={m.property_section_flat()}>
          <form.Field name="roomCount">
            {(field) => (
              <ChoiceField
                field={field}
                label={m.property_room_count()}
                choices={ROOM_COUNTS.map((count) => ({
                  value: count,
                  label: roomCountLabel(count),
                }))}
              />
            )}
          </form.Field>
          <form.Field name="floorArea">
            {(field) => (
              <TextField
                field={field}
                label={m.property_floor_area()}
                placeholder={m.property_floor_area_placeholder()}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                fullWidth
              />
            )}
          </form.Field>
        </Section>
        <Section title={m.property_section_housing_company()}>
          <Typography variant="body2" color="text.secondary">
            {m.property_housing_company_hint()}
          </Typography>
          <form.Field name="housingCompanyName">
            {(field) => (
              <TextField
                field={field}
                label={m.property_housing_company_name()}
                placeholder={m.property_housing_company_name_placeholder()}
                fullWidth
              />
            )}
          </form.Field>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 1.25,
            }}
          >
            <form.Field name="businessId">
              {(field) => (
                <TextField
                  field={field}
                  label={m.property_business_id()}
                  placeholder={m.property_business_id_placeholder()}
                />
              )}
            </form.Field>
            <form.Field name="apartmentNumber">
              {(field) => (
                <TextField
                  field={field}
                  label={m.property_apartment_number()}
                  placeholder={m.property_apartment_number_placeholder()}
                />
              )}
            </form.Field>
          </Box>
        </Section>
        {initial.ownedSince === undefined ? null : (
          <Section title={m.property_section_ownership()}>
            <form.Field name="ownedSince">
              {(field) => (
                <TextField
                  field={field}
                  label={m.property_owned_since()}
                  placeholder={m.date_placeholder()}
                  fullWidth
                />
              )}
            </form.Field>
            <Typography variant="body2" color="text.secondary">
              {m.property_owned_since_hint()}
            </Typography>
          </Section>
        )}
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
      </Stack>
      <Box
        component="footer"
        sx={{
          position: 'sticky',
          bottom: 0,
          px: 2.5,
          pt: 1.5,
          pb: 'calc(28px + env(safe-area-inset-bottom))',
          bgcolor: 'background.default',
          borderTop: `1px solid ${colors.cardBorder}`,
        }}
      >
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button
              type="submit"
              size="large"
              fullWidth
              loading={submitting}
              loadingPosition="start"
              sx={{ minHeight: 56, fontSize: 17 }}
            >
              {submitting ? m.property_saving() : m.property_save()}
            </Button>
          )}
        </form.Subscribe>
      </Box>
    </Stack>
  )
}
