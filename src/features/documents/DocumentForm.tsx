// Adding or editing a document (Design canvas: "Lisää dokumentti", "Muokkaa
// dokumenttia"): the file (when adding), kind, name, date and, for a lease,
// its tenancy (openspec: documents, "Adding a document", "Editing a
// document"). Adding sends the file with the fields as form data.
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useForm, useSelector } from '@tanstack/react-form'
import { useState } from 'react'
import { ReasonAlert } from '#/components/ReasonAlert'
import { ChoiceField } from '#/components/form/ChoiceField'
import { FileField } from '#/components/form/FileField'
import { TextField } from '#/components/form/TextField'
import { clientLog } from '#/lib/client-log'
import { parseFiDate, type IsoDate } from '#/lib/dates'
import { formatDate } from '#/lib/format'
import { failureReason } from '#/lib/network-error'
import type { AlertReason, FieldReason } from '#/lib/reasons'
import { ImageProblem, prepareUpload } from '#/lib/resize-image'
import { m } from '#/paraglide/messages.js'
import type { DocumentDetails } from './document.repository.server'
import type { TenancyChoice } from './documents.server'
import { addDocument, updateDocument } from './functions'
import { DOCUMENT_KINDS, kindLabel } from './kinds'
import { documentFields } from './schemas'

interface Props {
  propertyId: string
  streetAddress: string
  tenancies: readonly TenancyChoice[]
  today: IsoDate
  /** The document being edited; without it the form adds one. */
  editing?: DocumentDetails
  onClose: () => void
  /** After saving: reload and show the document. */
  onSaved: (documentId: string) => Promise<void>
}

type FieldName = 'file' | 'name' | 'date'

const FIELD_OF: Partial<Record<FieldReason, FieldName>> = {
  document_unsupported_type: 'file',
  document_too_large: 'file',
  document_unreadable: 'file',
  document_name_required: 'name',
  document_name_too_long: 'name',
  date_invalid: 'date',
}

const NO_TENANCY = ''

/** The file's name without its extension. */
function nameOf(file: File): string {
  return file.name.replace(/\.[^.]*$/, '')
}

function tenancyLabel(tenancy: TenancyChoice): string {
  const to = tenancy.validTo ? formatDate(tenancy.validTo) : ''
  return `${tenancy.tenantName} · ${formatDate(tenancy.validFrom)}–${to}`
}

export function DocumentForm(props: Props) {
  const editing = props.editing
  const [file, setFile] = useState<File>()
  // The name suggested from the chosen file, replaced while the user hasn't
  // typed their own.
  const [suggested, setSuggested] = useState('')
  const [reasons, setReasons] = useState<
    Partial<Record<FieldName, FieldReason>>
  >({})
  const [alert, setAlert] = useState<AlertReason>()
  const clearReason = (name: FieldName) => {
    setReasons((current) => ({ ...current, [name]: undefined }))
  }
  // The current tenancy is first and preselected for a new lease.
  const defaultTenancy = props.tenancies[0]?.id ?? NO_TENANCY

  const showReason = (reason: FieldReason | AlertReason) => {
    const field = FIELD_OF[reason as FieldReason]
    if (field) {
      setReasons({ [field]: reason as FieldReason })
    } else {
      setAlert(reason as AlertReason)
    }
  }

  const form = useForm({
    defaultValues: {
      kind: editing?.kind ?? 'other',
      name: editing?.name ?? '',
      date: formatDate(editing?.date ?? props.today),
      tenancyId: editing ? (editing.tenancyId ?? NO_TENANCY) : defaultTenancy,
    },
    onSubmit: async ({ value }) => {
      setAlert(undefined)
      setReasons({})
      const date = parseFiDate(value.date)
      if (date === undefined) {
        setReasons({ date: 'date_invalid' })
        return
      }
      const parsed = documentFields.safeParse({ ...value, date: value.date })
      if (!parsed.success) {
        const reason = parsed.error.issues[0]?.message as FieldReason
        const field = FIELD_OF[reason]
        if (field) {
          setReasons({ [field]: reason })
        }
        return
      }
      if (!editing && !file) {
        setReasons({ file: 'document_unsupported_type' })
        return
      }
      try {
        const fields = {
          propertyId: props.propertyId,
          kind: value.kind,
          name: value.name,
          date: value.date,
          tenancyId: value.kind === 'lease' ? value.tenancyId : '',
        }
        if (editing) {
          const result = await updateDocument({
            data: { ...fields, documentId: editing.id },
          })
          if (result.ok) {
            await props.onSaved(editing.id)
            return
          }
          showReason(result.reason)
          return
        }
        const data = new FormData()
        for (const [key, text] of Object.entries(fields)) {
          data.set(key, text)
        }
        if (file) {
          data.set('file', await prepareUpload(file))
        }
        const result = await addDocument({ data })
        if (result.ok) {
          await props.onSaved(result.documentId)
          return
        }
        showReason(result.reason)
      } catch (error) {
        if (error instanceof ImageProblem) {
          setReasons({ file: `document_${error.problem}` })
          return
        }
        clientLog.error('document.save_failed', {}, error)
        setAlert(failureReason(error))
      }
    },
  })

  const kind = useSelector(form.store, (s) => s.values.kind)
  const submitting = useSelector(form.store, (s) => s.isSubmitting)

  return (
    <Stack
      component="form"
      noValidate
      aria-labelledby="document-form-title"
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
          gridTemplateColumns: '44px 1fr 44px',
          alignItems: 'center',
          px: 1.5,
          pt: 2,
          pb: 0.5,
        }}
      >
        <IconButton aria-label={m.documents_close()} onClick={props.onClose}>
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
        </IconButton>
        <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
          <Typography
            id="document-form-title"
            variant="h3"
            component="h1"
            sx={{ fontSize: 18 }}
          >
            {editing ? m.documents_edit_title() : m.documents_new()}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {props.streetAddress}
          </Typography>
        </Stack>
      </Box>
      <Stack
        component="main"
        sx={{ flex: 1, gap: 1.75, px: 2.5, pt: 1, pb: 2.5 }}
      >
        {editing ? null : (
          <FileField
            title={m.documents_file()}
            file={file}
            reason={reasons.file}
            submitting={submitting}
            onChoose={(chosen) => {
              setFile(chosen)
              clearReason('file')
              const current = form.getFieldValue('name')
              if (current === '' || current === suggested) {
                const next = nameOf(chosen)
                setSuggested(next)
                form.setFieldValue('name', next)
              }
            }}
            onRemove={() => {
              setFile(undefined)
            }}
            labels={{
              attach: m.documents_attach(),
              hint: m.documents_attach_hint(),
              saving: m.documents_saving(),
              remove: m.documents_remove_file(),
              replace: m.documents_attach(),
            }}
          />
        )}
        <form.Field name="kind">
          {(field) => (
            <ChoiceField
              field={field}
              label={m.documents_kind()}
              stacked
              choices={DOCUMENT_KINDS.map((value) => ({
                value,
                label: kindLabel[value](),
              }))}
            />
          )}
        </form.Field>
        {kind === 'lease' && props.tenancies.length > 0 ? (
          <form.Field name="tenancyId">
            {(field) => (
              <ChoiceField
                field={field}
                label={m.documents_tenancy()}
                stacked
                choices={[
                  ...props.tenancies.map((tenancy) => ({
                    value: tenancy.id,
                    label: tenancyLabel(tenancy),
                  })),
                  { value: NO_TENANCY, label: m.documents_no_tenancy() },
                ]}
              />
            )}
          </form.Field>
        ) : null}
        <form.Field
          name="name"
          validators={{ onChange: documentFields.shape.name }}
          listeners={{
            onChange: () => {
              clearReason('name')
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={reasons.name}
              label={m.documents_name()}
            />
          )}
        </form.Field>
        <form.Field
          name="date"
          listeners={{
            onChange: () => {
              clearReason('date')
            },
          }}
        >
          {(field) => (
            <TextField
              field={field}
              reason={reasons.date}
              label={m.documents_date()}
              placeholder={m.date_placeholder()}
            />
          )}
        </form.Field>
        {alert === undefined ? null : <ReasonAlert reason={alert} />}
      </Stack>
      <Stack
        component="footer"
        sx={{
          position: 'sticky',
          bottom: 0,
          px: 2.5,
          pt: 1.5,
          pb: 3.5,
          bgcolor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ minHeight: 56, borderRadius: 999, fontSize: 17 }}
        >
          {submitting ? m.documents_saving() : m.documents_save()}
        </Button>
      </Stack>
    </Stack>
  )
}
