// The bottom navigation bar on the main pages (Design canvas: "Alapalkki";
// openspec: navigation): Flats · New entry · Account. Statistics and Taxes
// join it when their pages exist. Forms and a flat's subpages don't show it.
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'
import { colors } from '#/theme/tokens'

export type NavPage = 'flats' | 'account'

function Icon(props: { children: React.ReactNode; size?: number }) {
  const size = props.size ?? 24
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

function Tab(props: {
  to: '/' | '/account'
  current: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <ButtonBase
      component={Link}
      to={props.to}
      aria-current={props.current ? 'page' : undefined}
      sx={{
        flexDirection: 'column',
        gap: 0.25,
        minHeight: 52,
        borderRadius: '14px',
        color: props.current ? colors.plum : colors.plumSubtle,
        fontFamily: 'inherit',
      }}
    >
      {props.icon}
      <Typography
        component="span"
        sx={{ fontSize: 12, fontWeight: props.current ? 900 : 800 }}
      >
        {props.label}
      </Typography>
    </ButtonBase>
  )
}

export function BottomNav({ current }: { current: NavPage }) {
  return (
    <Box
      component="nav"
      aria-label={m.nav_label()}
      sx={{
        position: 'sticky',
        bottom: 0,
        mt: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        alignItems: 'center',
        bgcolor: 'background.paper',
        borderTop: `1px solid ${colors.cardBorder}`,
        px: 3,
        pt: 1,
        pb: 3.25,
      }}
    >
      <Tab
        to="/"
        current={current === 'flats'}
        label={m.properties_title()}
        icon={
          <Icon>
            <path d="M3 11 L12 4 L21 11" />
            <path d="M5.5 9.5 V20 H18.5 V9.5" />
          </Icon>
        }
      />
      <ButtonBase
        component={Link}
        to="/transactions/new"
        aria-label={m.transactions_new()}
        sx={{
          justifySelf: 'center',
          width: 56,
          height: 56,
          borderRadius: '28px',
          bgcolor: colors.yellow,
          color: colors.plum,
          boxShadow: '0 4px 12px rgba(43,27,61,0.18)',
        }}
      >
        <Icon size={26}>
          <path d="M6 3 H18 V21 L15.5 19.5 L13 21 L11 19.5 L8.5 21 L6 19.5 Z" />
          <path d="M9.5 8 H14.5 M9.5 12 H14.5 M9.5 16 H12" />
        </Icon>
      </ButtonBase>
      <Tab
        to="/account"
        current={current === 'account'}
        label={m.account_title()}
        icon={
          <Icon>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20 a8 8 0 0 1 16 0" />
          </Icon>
        }
      />
    </Box>
  )
}
