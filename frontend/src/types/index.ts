// User roles
export type UserRole = 'Admin' | 'Manager' | 'Member'

// Cognito user shape (simplified, matching Amplify v6 output)
export interface CognitoUser {
  userId: string
  username: string
  email: string
  role: UserRole
  signInDetails?: {
    loginId?: string
    authFlowType?: string
  }
}

// Member
export interface Member {
  memberId: string
  dni: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  membershipType: MembershipType
  membershipStatus: MembershipStatus
  membershipExpiry: string // ISO date string
  createdAt: string
  updatedAt: string
}

export type MembershipType = 'Basic' | 'Premium' | 'Family' | 'Student'
export type MembershipStatus = 'Active' | 'Inactive' | 'Suspended' | 'Expired'

// Area (sports court, pool, etc.)
export interface Area {
  areaId: string
  name: string
  description: string
  capacity: number
  type: AreaType
  amenities: string[]
  imageUrl?: string
  isActive: boolean
}

export type AreaType = 'Court' | 'Pool' | 'Gym' | 'Field' | 'Room'

// Reservation
export interface Reservation {
  reservationId: string
  memberId: string
  member?: Pick<Member, 'firstName' | 'lastName' | 'email'>
  areaId: string
  area?: Pick<Area, 'name' | 'type'>
  date: string // ISO date string YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  status: ReservationStatus
  guestCount: number
  guests: Guest[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed' | 'NoShow'

// Guest
export interface Guest {
  guestId: string
  reservationId: string
  firstName: string
  lastName: string
  dni: string
}

// Promotion
export interface Promotion {
  promotionId: string
  title: string
  description: string
  discountType: 'Percentage' | 'Fixed'
  discountValue: number
  startDate: string // ISO date string
  endDate: string // ISO date string
  targetMembershipTypes: MembershipType[]
  isActive: boolean
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  timestamp: string
}

// API error shape
export interface ApiError {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  timestamp: string
}

// Navigation item
export interface NavItem {
  label: string
  href: string
  icon?: string
  roles?: UserRole[]
}
