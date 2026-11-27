// The year summary's *Lataa PDF* button (Design canvas: VerotPdf; openspec:
// year-summary, "Downloading the year summary as a PDF"): asks the server for
// the year's figures, builds the PDF in the browser with the library loaded
// only now, and downloads it. Nothing is stored, so nothing is logged on
// success; a failure is logged without figures or names.
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import { clientLog } from '#/lib/client-log'
import { failureReason } from '#/lib/network-error'
import { reasonText } from '#/lib/reasons'
import { m } from '#/paraglide/messages.js'
import { getYearSummaryPdf } from './functions'
import { pdfFileName } from './pdf-file-name'
import type { YearSummaryPdfView } from './view'

interface Props {
  year: number
  /** Another owner's id or `whole`; undefined is the own share. */
  person: string | undefined
  /** Loads the view; the server function by default. */
  load?: (input: {
    year: number
    person: string | undefined
  }) => Promise<YearSummaryPdfView>
  /** Builds the PDF; jsPDF's renderer, loaded on demand, by default. */
  build?: (view: YearSummaryPdfView, now: Date) => Promise<Blob>
  /** Hands the file to the browser. */
  save?: (blob: Blob, fileName: string) => void
}

const loadView = (input: { year: number; person: string | undefined }) =>
  getYearSummaryPdf({ data: input })

async function buildPdf(view: YearSummaryPdfView, now: Date): Promise<Blob> {
  const { renderYearSummaryPdf } = await import('./pdf-render')
  return renderYearSummaryPdf(view, now)
}

/** Downloads through a link clicked from code, then lets the URL go. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function PdfButton(props: Props) {
  const load = props.load ?? loadView
  const build = props.build ?? buildPdf
  const save = props.save ?? saveBlob
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<'network' | 'unexpected' | undefined>()
  const [notice, setNotice] = useState<string | undefined>()

  const download = async () => {
    setBusy(true)
    setFailed(undefined)
    setNotice(undefined)
    try {
      const view = await load({ year: props.year, person: props.person })
      const blob = await build(view, new Date())
      const fileName = pdfFileName(view.holder, view.year)
      save(blob, fileName)
      setNotice(m.pdf_notice({ file: fileName }))
    } catch (error) {
      clientLog.error('year_summary.pdf_failed', {}, error)
      setFailed(failureReason(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack sx={{ gap: 1 }}>
      <Button
        variant="contained"
        color="accent"
        disabled={busy}
        onClick={() => {
          void download()
        }}
        sx={{ borderRadius: 999, minHeight: 48 }}
      >
        {busy ? m.pdf_busy() : m.pdf_button()}
      </Button>
      {failed === undefined ? null : (
        <Alert severity="error">
          <AlertTitle>{m.pdf_failed()}</AlertTitle>
          {reasonText(failed).text}
        </Alert>
      )}
      <Snackbar
        open={notice !== undefined}
        autoHideDuration={6000}
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
