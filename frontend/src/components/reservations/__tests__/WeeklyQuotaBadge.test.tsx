import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeeklyQuotaBadge } from '../WeeklyQuotaBadge'

describe('WeeklyQuotaBadge', () => {
  it('displays used / limit counts', () => {
    render(<WeeklyQuotaBadge used={1} limit={3} exhausted={false} />)
    expect(screen.getByText(/1/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('does NOT show the exhaustion warning when quota has remaining slots', () => {
    render(<WeeklyQuotaBadge used={1} limit={3} exhausted={false} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows exhaustion warning banner when exhausted=true (AC-011)', () => {
    render(<WeeklyQuotaBadge used={3} limit={3} exhausted />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(/límite semanal/i)
  })

  it('shows "(cuota alcanzada)" text when exhausted', () => {
    render(<WeeklyQuotaBadge used={3} limit={3} exhausted />)
    expect(screen.getByText(/cuota alcanzada/i)).toBeInTheDocument()
  })

  it('has status role for screen readers', () => {
    render(<WeeklyQuotaBadge used={2} limit={3} exhausted={false} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders correct aria-label', () => {
    render(<WeeklyQuotaBadge used={2} limit={3} exhausted={false} />)
    expect(
      screen.getByLabelText('Reservas semanales: 2 de 3 usadas')
    ).toBeInTheDocument()
  })
})
