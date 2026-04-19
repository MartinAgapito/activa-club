import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlotCard } from '../SlotCard'
import type { SlotAvailability } from '@/api/areas.api'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const availableSlot: SlotAvailability = {
  startTime: '09:00',
  endTime: '10:00',
  available: 3,
  total: 5,
  status: 'AVAILABLE',
  blocked: false,
}

const fullSlot: SlotAvailability = {
  startTime: '10:00',
  endTime: '11:00',
  available: 0,
  total: 5,
  status: 'FULL',
  blocked: false,
}

const blockedSlot: SlotAvailability = {
  startTime: '11:00',
  endTime: '12:00',
  available: 0,
  total: 5,
  status: 'BLOCKED',
  blocked: true,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SlotCard', () => {
  describe('AVAILABLE slot', () => {
    it('renders the time range', () => {
      render(<SlotCard slot={availableSlot} hideReserveButton />)
      expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument()
    })

    it('shows "Disponible" badge', () => {
      render(<SlotCard slot={availableSlot} hideReserveButton />)
      expect(screen.getByText('Disponible')).toBeInTheDocument()
    })

    it('shows occupancy text', () => {
      render(<SlotCard slot={availableSlot} hideReserveButton />)
      expect(screen.getByText('3/5 cupos')).toBeInTheDocument()
    })

    it('renders with role="button" when selectable', () => {
      render(<SlotCard slot={availableSlot} onSelect={vi.fn()} hideReserveButton />)
      expect(screen.getByRole('button', { name: /Reservar franja 09:00 - 10:00/ })).toBeInTheDocument()
    })

    it('calls onSelect when clicked', () => {
      const onSelect = vi.fn()
      render(<SlotCard slot={availableSlot} onSelect={onSelect} hideReserveButton />)
      fireEvent.click(screen.getByRole('button', { name: /Reservar franja/ }))
      expect(onSelect).toHaveBeenCalledWith(availableSlot)
    })

    it('calls onSelect on Enter key press', () => {
      const onSelect = vi.fn()
      render(<SlotCard slot={availableSlot} onSelect={onSelect} hideReserveButton />)
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
      expect(onSelect).toHaveBeenCalledWith(availableSlot)
    })

    it('does not call onSelect when ctaDisabled', () => {
      const onSelect = vi.fn()
      render(<SlotCard slot={availableSlot} onSelect={onSelect} ctaDisabled hideReserveButton />)
      // With ctaDisabled the container div loses role="button"
      const container = screen.queryByRole('button')
      if (container) fireEvent.click(container)
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('shows Reservar button when hideReserveButton=false', () => {
      render(<SlotCard slot={availableSlot} onSelect={vi.fn()} hideReserveButton={false} />)
      expect(screen.getByRole('button', { name: /Reservar franja 09:00 - 10:00/ })).toBeInTheDocument()
    })

    it('hides Reservar button when hideReserveButton=true', () => {
      render(<SlotCard slot={availableSlot} onSelect={vi.fn()} hideReserveButton />)
      // The only interactive element should be the container div acting as button
      // The explicit <button> element should not exist
      expect(screen.queryByText('Reservar')).not.toBeInTheDocument()
    })
  })

  describe('FULL slot', () => {
    it('shows "Sin disponibilidad" badge', () => {
      render(<SlotCard slot={fullSlot} />)
      expect(screen.getByText('Sin disponibilidad')).toBeInTheDocument()
    })

    it('shows occupancy text', () => {
      render(<SlotCard slot={fullSlot} />)
      expect(screen.getByText('0/5 cupos')).toBeInTheDocument()
    })

    it('does not render a role=button', () => {
      render(<SlotCard slot={fullSlot} />)
      // Full slots are never interactive
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('BLOCKED slot', () => {
    it('shows "No disponible" badge', () => {
      render(<SlotCard slot={blockedSlot} />)
      expect(screen.getByText('No disponible')).toBeInTheDocument()
    })

    it('does not show occupancy text for blocked slot (AC-011 requirement)', () => {
      render(<SlotCard slot={blockedSlot} />)
      expect(screen.queryByText(/cupos/i)).not.toBeInTheDocument()
    })

    it('does not render a role=button', () => {
      render(<SlotCard slot={blockedSlot} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
