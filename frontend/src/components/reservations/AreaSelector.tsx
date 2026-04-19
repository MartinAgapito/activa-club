import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

// ─── Area item shape ──────────────────────────────────────────────────────────

export interface AreaOption {
  areaId: string
  name: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AreaSelectorProps {
  /** Pre-filtered list of areas accessible to the current user. */
  areas: AreaOption[]
  value: string
  onChange: (areaId: string) => void
  isLoading?: boolean
  isError?: boolean
  disabled?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AC-011: Dropdown to select an area for availability querying.
 *
 * The parent is responsible for filtering the `areas` list to only those
 * accessible by the member's membership type. This keeps the component
 * pure and easy to test.
 *
 * If the filtered list is empty and not loading, a friendly message is shown
 * instead of an empty dropdown.
 */
export function AreaSelector({
  areas,
  value,
  onChange,
  isLoading = false,
  isError = false,
  disabled = false,
}: AreaSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando áreas…
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Error al cargar las áreas. Recargá la página.
      </p>
    )
  }

  if (areas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No hay áreas disponibles para tu tipo de membresía.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="area-selector">Área</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id="area-selector"
          aria-label="Seleccionar área"
          className="w-full"
        >
          <SelectValue placeholder="Seleccioná un área" />
        </SelectTrigger>
        <SelectContent>
          {areas.map((area) => (
            <SelectItem key={area.areaId} value={area.areaId}>
              {area.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
