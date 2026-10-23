import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import communityIllustration from './assets/community-illustration.svg'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import './style.css'

type IconName =
  | 'grid'
  | 'inbox'
  | 'door'
  | 'calendar'
  | 'wallet'
  | 'megaphone'
  | 'help'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'arrow'
  | 'plus'
  | 'clock'
  | 'check'
  | 'more'
  | 'building'
  | 'menu'
  | 'close'
  | 'sparkle'
  | 'car'
  | 'key'

interface AuthenticatedUser {
  id: string
  email: string
  fullName: string
}

interface AuthResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthenticatedUser
}

interface CommunityMembership {
  membershipId: string
  community: {
    id: string
    name: string
    slug: string
  }
  roles: string[]
}

interface CommunityMemberRole {
  membershipId: string
  fullName: string
  email: string
  roles: string[]
}

interface CommunityUnit {
  id: string
  number: string
  floor: number | null
}

interface CommunityBlock {
  id: string
  name: string
  code: string
  units: CommunityUnit[]
}

interface CommunityStructure {
  id: string
  name: string
  slug: string
  blocks: CommunityBlock[]
}

interface CommunityInvitation {
  id: string
  unit: {
    id: string
    number: string
    block: { name: string; code: string }
  }
  createdAt: string
  expiresAt: string
  redeemedAt: string | null
  revokedAt: string | null
  status: 'ACTIVE' | 'EXPIRED' | 'REDEEMED' | 'REVOKED'
}

interface CreatedCommunityInvitation {
  id: string
  code: string
  expiresAt: string
}

type ServiceRequestCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'CLEANING'
  | 'SECURITY'
  | 'GENERAL'

type ServiceRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

interface ServiceRequestStatusUpdate {
  id: string
  previousStatus: ServiceRequestStatus
  status: ServiceRequestStatus
  note: string | null
  createdAt: string
  updatedByName: string
}

interface CommunityServiceRequest {
  id: string
  title: string
  category: ServiceRequestCategory
  description: string | null
  location: string
  status: ServiceRequestStatus
  createdAt: string
  updatedAt: string
  creatorName: string
  statusHistory: ServiceRequestStatusUpdate[]
}

type VisitorPassStatus = 'EXPECTED' | 'CHECKED_IN' | 'CHECKED_OUT'
type VisitorPurpose = 'PERSONAL_VISIT' | 'DELIVERY' | 'SERVICE'

interface VisitorUnit {
  id: string
  number: string
  block: { name: string; code: string }
}

interface VisitorPass {
  id: string
  visitorName: string
  purpose: VisitorPurpose
  expectedAt: string
  status: VisitorPassStatus
  checkedInAt: string | null
  checkedOutAt: string | null
  createdAt: string
  hostName: string
  unit: VisitorUnit
  checkedInByName: string | null
  checkedOutByName: string | null
}

interface CommunityAmenity {
  id: string
  name: string
  description: string | null
  location: string | null
  isActive: boolean
}

type AmenityBookingStatus = 'CONFIRMED' | 'CANCELLED'

interface AmenityBooking {
  id: string
  amenityId: string
  amenityName: string
  startsAt: string
  endsAt: string
  status: AmenityBookingStatus
  bookedByName: string | null
  isMine: boolean
  canCancel: boolean
}

class AuthApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AuthApiError'
  }
}

const authApiBase = import.meta.env.VITE_API_URL ?? ''
const browserRequestHeader = 'communityos-web'

function authRequest(endpoint: string, body?: unknown): Promise<void>
function authRequest<T>(endpoint: string, body?: unknown): Promise<T>
async function authRequest<T>(endpoint: string, body?: unknown): Promise<T | void> {
  const response = await fetch(`${authApiBase}/auth/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CommunityOS-Client': browserRequestHeader,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    let message = `The server returned an error (${response.status}).`
    try {
      const result = (await response.json()) as { message?: string | string[] }
      if (result.message) {
        message = Array.isArray(result.message)
          ? result.message.join(' ')
          : result.message
      }
    } catch {
      message = `The server returned an unreadable error (${response.status}).`
    }
    throw new AuthApiError(message, response.status)
  }

  if (response.status === 204) return
  return (await response.json()) as T
}

async function communityRequest<T>(
  endpoint: string,
  accessToken: string,
  body?: unknown,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' =
    body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const response = await fetch(`${authApiBase}/communities${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    let message = `The server returned an error (${response.status}).`
    try {
      const result = (await response.json()) as { message?: string | string[] }
      if (result.message) {
        message = Array.isArray(result.message)
          ? result.message.join(' ')
          : result.message
      }
    } catch {
      message = `The server returned an unreadable error (${response.status}).`
    }
    throw new AuthApiError(message, response.status)
  }

  return (await response.json()) as T
}

async function loadCommunityState(
  accessToken: string,
  preferredCommunityId?: string | null,
): Promise<{
  memberships: CommunityMembership[]
  structure: CommunityStructure | null
  activeCommunityId: string | null
}> {
  const memberships = await communityRequest<CommunityMembership[]>(
    '/mine',
    accessToken,
  )
  const selectedMembership =
    memberships.find(
      (membership) => membership.community.id === preferredCommunityId,
    ) ?? memberships[0]
  if (!selectedMembership) {
    return { memberships, structure: null, activeCommunityId: null }
  }

  const structure = await communityRequest<CommunityStructure>(
    `/${selectedMembership.community.id}/structure`,
    accessToken,
  )
  return {
    memberships,
    structure,
    activeCommunityId: selectedMembership.community.id,
  }
}

function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /></>,
    inbox: <><path d="M4 4h16l1.5 10H16l-2 3h-4l-2-3H2.5L4 4Z" /><path d="M4 4v15h16V4" /></>,
    door: <><path d="M4 21h16M6 21V4l12-2v19" /><path d="M14 12h.01" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    wallet: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M16 15h2" /><path d="M6 5V3h12v2" /></>,
    megaphone: <><path d="m3 11 18-5v12L3 14v-3Z" /><path d="m7 15 2 6h4l-2-5M21 9a3 3 0 0 1 0 6" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.4c-1 1.1-2.2 1.4-2.2 3.1M12 17.5h.01" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.2L22 17l-1.9.8L19 20l-.9-2.2L16 17l2.1-.8L19 14Z" /></>,
    car: <><path d="m5 11 1.5-5h11L19 11l2 2v5h-2M3 18v-5l2-2M5 11h14M6 18h12" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /></>,
    key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 9-9M17 6l2 2M14 9l2 2" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

const navigation: { label: string; icon: IconName; section: string }[] = [
  { label: 'Overview', icon: 'grid', section: 'Home' },
  { label: 'My requests', icon: 'inbox', section: 'Your community' },
  { label: 'Visitor log', icon: 'door', section: 'Your community' },
  { label: 'Amenities', icon: 'calendar', section: 'Your community' },
  { label: 'My payments', icon: 'wallet', section: 'Your community' },
  { label: 'Announcements', icon: 'megaphone', section: 'Your community' },
]

const announcements = [
  {
    tag: 'BLOCK A',
    date: 'TODAY · 9:15 AM',
    title: 'Water tank cleaning this Saturday',
    body: 'Water supply may be interrupted between 10 am and 1 pm. Please plan accordingly.',
    color: 'mint',
  },
  {
    tag: 'COMMUNITY',
    date: 'YESTERDAY',
    title: 'The garden has a new look 🌱',
    body: 'The east courtyard is ready for you. Take a moment to enjoy the refreshed space.',
    color: 'sand',
  },
  {
    tag: 'BLOCK A',
    date: 'FRIDAY',
    title: 'A reminder about quiet hours',
    body: 'Let’s keep shared spaces peaceful between 10 pm and 7 am. Thanks for being thoughtful neighbors.',
    color: 'mint',
  },
  {
    tag: 'COMMUNITY',
    date: 'THURSDAY',
    title: 'Weekend yoga in the garden',
    body: 'Join your neighbors for a relaxed outdoor yoga session this Sunday at 7:30 am. All levels welcome.',
    color: 'sand',
  },
]

const pendingMaintenance = 4850
function App() {
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [accessTokenExpiresIn, setAccessTokenExpiresIn] = useState(0)
  const [authLoading, setAuthLoading] = useState(true)
  const [communityStatus, setCommunityStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [communityMemberships, setCommunityMemberships] = useState<CommunityMembership[]>([])
  const [communityStructure, setCommunityStructure] = useState<CommunityStructure | null>(null)
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null)
  const [communityInvitations, setCommunityInvitations] = useState<CommunityInvitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(false)
  const [invitationBusy, setInvitationBusy] = useState(false)
  const [invitationError, setInvitationError] = useState('')
  const [createdInvitation, setCreatedInvitation] = useState<CreatedCommunityInvitation | null>(null)
  const [communityRequests, setCommunityRequests] = useState<CommunityServiceRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestStatusBusy, setRequestStatusBusy] = useState(false)
  const [requestStatusError, setRequestStatusError] = useState('')
  const requestsLoadSequence = useRef(0)
  const [visitorPasses, setVisitorPasses] = useState<VisitorPass[]>([])
  const [visitorPassesLoading, setVisitorPassesLoading] = useState(false)
  const [visitorPassesError, setVisitorPassesError] = useState('')
  const [visitorUnits, setVisitorUnits] = useState<VisitorUnit[]>([])
  const [visitorUnitsLoading, setVisitorUnitsLoading] = useState(false)
  const [visitorBusy, setVisitorBusy] = useState(false)
  const [visitorError, setVisitorError] = useState('')
  const [visitorStatusBusy, setVisitorStatusBusy] = useState(false)
  const [amenities, setAmenities] = useState<CommunityAmenity[]>([])
  const [amenityBookings, setAmenityBookings] = useState<AmenityBooking[]>([])
  const [amenitiesLoading, setAmenitiesLoading] = useState(false)
  const [amenitiesError, setAmenitiesError] = useState('')
  const [amenityBusy, setAmenityBusy] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingAmenityId, setBookingAmenityId] = useState('')
  const [communityMembers, setCommunityMembers] = useState<CommunityMemberRole[]>([])
  const [communityMembersLoading, setCommunityMembersLoading] = useState(false)
  const [communityMembersError, setCommunityMembersError] = useState('')
  const [roleUpdateBusy, setRoleUpdateBusy] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activePage, setActivePage] = useState('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true)
  const [showAllRequests, setShowAllRequests] = useState(false)
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false)
  const [modalType, setModalType] = useState<'request' | 'visitor' | 'booking' | null>(null)
  const [toast, setToast] = useState('')
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false)

  const acceptAuthResponse = (
    result: AuthResponse,
    preferredCommunityId?: string | null,
  ) => {
    setAuthUser(result.user)
    setAccessToken(result.accessToken)
    setAccessTokenExpiresIn(result.expiresIn)
    setAuthError('')
    setCommunityStatus('loading')
    setCommunityStructure(null)
    loadCommunityState(result.accessToken, preferredCommunityId)
      .then(({ memberships, structure, activeCommunityId }) => {
        setCommunityMemberships(memberships)
        setCommunityStructure(structure)
        setActiveCommunityId(activeCommunityId)
        setCommunityStatus('ready')
      })
      .catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : 'Unable to load your community.')
        setCommunityStatus('error')
      })
  }

  useEffect(() => {
    let active = true
    authRequest<AuthResponse>('refresh')
      .then((result) => {
        if (active) acceptAuthResponse(result, activeCommunityId)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (!(error instanceof AuthApiError) || ![401, 403].includes(error.status)) {
          setAuthError(error instanceof Error ? error.message : 'Unable to restore your session.')
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!accessToken || !accessTokenExpiresIn) return
    const timer = window.setTimeout(() => {
      authRequest<AuthResponse>('refresh')
        .then(acceptAuthResponse)
        .catch((error: unknown) => {
          setAuthError(error instanceof Error ? error.message : 'Your session could not be renewed.')
          setAuthUser(null)
          setAccessToken(null)
        })
    }, Math.max(accessTokenExpiresIn - 60, 1) * 1000)
    return () => window.clearTimeout(timer)
  }, [accessToken, accessTokenExpiresIn, activeCommunityId])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    const body = Object.fromEntries(formData.entries())
    try {
      const result = await authRequest<AuthResponse>(
        authMode === 'signup' ? 'register' : 'login',
        body,
      )
      acceptAuthResponse(result)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    setAuthBusy(true)
    setAuthError('')
    try {
      await authRequest('logout')
      setAuthUser(null)
      setAccessToken(null)
      setAccessTokenExpiresIn(0)
      setCommunityMemberships([])
      setCommunityStructure(null)
      setActiveCommunityId(null)
      setCommunityInvitations([])
      setCreatedInvitation(null)
      setInvitationError('')
      setVisitorPasses([])
      setVisitorUnits([])
      setVisitorError('')
      setVisitorPassesError('')
      setAmenities([])
      setAmenityBookings([])
      setAmenitiesError('')
      setBookingError('')
      setCommunityMembers([])
      setCommunityMembersError('')
      setCommunityStatus('loading')
      setActivePage('Overview')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign out.')
    } finally {
      setAuthBusy(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const membershipForActiveCommunity =
    communityMemberships.find(
      (membership) => membership.community.id === activeCommunityId,
    ) ?? communityMemberships[0]
  const invitationCommunityId = membershipForActiveCommunity?.community.id
  const canManageInvitations =
    membershipForActiveCommunity?.roles.includes('ADMINISTRATOR') ?? false

  useEffect(() => {
    if (
      activePage !== 'Invitations' ||
      !accessToken ||
      !invitationCommunityId ||
      !canManageInvitations
    ) return

    let active = true
    setInvitationsLoading(true)
    setInvitationError('')
    communityRequest<CommunityInvitation[]>(
      `/${invitationCommunityId}/invitations`,
      accessToken,
    )
      .then((invitations) => {
        if (active) setCommunityInvitations(invitations)
      })
      .catch((error: unknown) => {
        if (active) {
          setInvitationError(
            error instanceof Error ? error.message : 'Unable to load invitations.',
          )
        }
      })
      .finally(() => {
        if (active) setInvitationsLoading(false)
      })
    return () => {
      active = false
    }
  }, [activePage, accessToken, invitationCommunityId, canManageInvitations])

  useEffect(() => {
    if (!accessToken || !activeCommunityId) {
      setCommunityRequests([])
      setRequestsLoading(false)
      return
    }

    let active = true
    const loadSequence = ++requestsLoadSequence.current
    setRequestsLoading(true)
    setRequestError('')
    communityRequest<CommunityServiceRequest[]>(
      `/${activeCommunityId}/requests`,
      accessToken,
    )
      .then((requests) => {
        if (active && loadSequence === requestsLoadSequence.current) {
          setCommunityRequests(requests)
        }
      })
      .catch((error: unknown) => {
        if (active && loadSequence === requestsLoadSequence.current) {
          setRequestError(
            error instanceof Error ? error.message : 'Unable to load requests.',
          )
        }
      })
      .finally(() => {
        if (active && loadSequence === requestsLoadSequence.current) {
          setRequestsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [activeCommunityId, accessToken])

  useEffect(() => {
    if (!accessToken || !activeCommunityId) {
      setAmenities([])
      setAmenityBookings([])
      setAmenitiesLoading(false)
      return
    }

    let active = true
    setAmenitiesLoading(true)
    setAmenitiesError('')
    setAmenities([])
    setAmenityBookings([])
    Promise.all([
      communityRequest<CommunityAmenity[]>(
        `/${activeCommunityId}/amenities`,
        accessToken,
      ),
      communityRequest<AmenityBooking[]>(
        `/${activeCommunityId}/amenities/bookings`,
        accessToken,
      ),
    ])
      .then(([availableAmenities, bookings]) => {
        if (!active) return
        setAmenities(availableAmenities)
        setAmenityBookings(bookings)
      })
      .catch((error: unknown) => {
        if (active) {
          setAmenitiesError(
            error instanceof Error ? error.message : 'Unable to load amenities.',
          )
        }
      })
      .finally(() => {
        if (active) setAmenitiesLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeCommunityId, accessToken])

  useEffect(() => {
    if (
      activePage !== 'Security team' ||
      !accessToken ||
      !activeCommunityId ||
      !membershipForActiveCommunity?.roles.includes('ADMINISTRATOR')
    ) {
      return
    }
    let active = true
    setCommunityMembersLoading(true)
    setCommunityMembersError('')
    communityRequest<CommunityMemberRole[]>(
      `/${activeCommunityId}/members`,
      accessToken,
    )
      .then((members) => {
        if (active) setCommunityMembers(members)
      })
      .catch((error: unknown) => {
        if (active) {
          setCommunityMembersError(
            error instanceof Error ? error.message : 'Unable to load community members.',
          )
        }
      })
      .finally(() => {
        if (active) setCommunityMembersLoading(false)
      })
    return () => {
      active = false
    }
  }, [activePage, accessToken, activeCommunityId, membershipForActiveCommunity])

  useEffect(() => {
    if (!accessToken || !activeCommunityId) {
      setVisitorPasses([])
      setVisitorUnits([])
      setVisitorPassesLoading(false)
      setVisitorUnitsLoading(false)
      return
    }

    let active = true
    setVisitorPassesLoading(true)
    setVisitorUnitsLoading(true)
    setVisitorPassesError('')
    setVisitorError('')
    communityRequest<VisitorPass[]>(
      `/${activeCommunityId}/visitor-passes`,
      accessToken,
    )
      .then((passes) => {
        if (active) setVisitorPasses(passes)
      })
      .catch((error: unknown) => {
        if (active) {
          setVisitorPassesError(
            error instanceof Error ? error.message : 'Unable to load visitor passes.',
          )
        }
      })
      .finally(() => {
        if (active) setVisitorPassesLoading(false)
      })
    communityRequest<VisitorUnit[]>(
      `/${activeCommunityId}/visitor-passes/units`,
      accessToken,
    )
      .then((units) => {
        if (active) setVisitorUnits(units)
      })
      .catch((error: unknown) => {
        if (active) {
          setVisitorError(
            error instanceof Error ? error.message : 'Unable to load your apartments.',
          )
        }
      })
      .finally(() => {
        if (active) setVisitorUnitsLoading(false)
      })

    return () => {
      active = false
    }
  }, [activeCommunityId, accessToken])

  const goTo = (page: string) => {
    setActivePage(page)
    setMenuOpen(false)
  }

  const openAmenityBooking = (amenityId = '') => {
    setBookingAmenityId(amenityId)
    setBookingError('')
    setModalType('booking')
  }

  const handleSelectCommunity = async (communityId: string) => {
    if (!accessToken) return
    setCommunityMenuOpen(false)
    setCommunityStatus('loading')
    setAuthError('')
    try {
      const { memberships, structure, activeCommunityId } =
        await loadCommunityState(accessToken, communityId)
      setCommunityMemberships(memberships)
      setCommunityStructure(structure)
      setActiveCommunityId(activeCommunityId)
      setActivePage('Overview')
      setCommunityStatus('ready')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to open this community.')
      setCommunityStatus('error')
    }
  }

  const handleCreateVisitorPass = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!accessToken || !activeCommunityId) return
    setVisitorBusy(true)
    setVisitorError('')
    const formData = new FormData(event.currentTarget)
    try {
      const expectedAt = new Date(
        `${formData.get('visitDate')}T${formData.get('arrivalTime')}`,
      )
      if (Number.isNaN(expectedAt.getTime())) {
        throw new Error('Choose a valid arrival date and time.')
      }
      const created = await communityRequest<VisitorPass>(
        `/${activeCommunityId}/visitor-passes`,
        accessToken,
        {
          visitorName: formData.get('visitorName'),
          unitId: formData.get('unitId'),
          purpose: formData.get('purpose'),
          expectedAt: expectedAt.toISOString(),
        },
      )
      setVisitorPasses((current) =>
        [created, ...current.filter((pass) => pass.id !== created.id)].sort(
          (a, b) => new Date(b.expectedAt).getTime() - new Date(a.expectedAt).getTime(),
        ),
      )
      setModalType(null)
      setToast('Visitor pass created and added to your visitor log.')
    } catch (error) {
      setVisitorError(
        error instanceof Error ? error.message : 'Unable to create this visitor pass.',
      )
    } finally {
      setVisitorBusy(false)
    }
  }

  const handleUpdateVisitorStatus = async (
    passId: string,
    status: VisitorPassStatus,
  ) => {
    if (!accessToken || !activeCommunityId) return
    setVisitorStatusBusy(true)
    setVisitorError('')
    try {
      const updated = await communityRequest<VisitorPass>(
        `/${activeCommunityId}/visitor-passes/${passId}/status`,
        accessToken,
        { status },
        'PATCH',
      )
      setVisitorPasses((current) =>
        current.map((pass) => pass.id === updated.id ? updated : pass),
      )
      setToast(
        status === 'CHECKED_IN'
          ? `${updated.visitorName} checked in.`
          : `${updated.visitorName} checked out.`,
      )
    } catch (error) {
      setVisitorError(
        error instanceof Error ? error.message : 'Unable to update visitor status.',
      )
    } finally {
      setVisitorStatusBusy(false)
    }
  }

  const handleCreateAmenity = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!accessToken || !activeCommunityId) return
    setAmenityBusy(true)
    setAmenitiesError('')
    const form = event.currentTarget
    const formData = new FormData(event.currentTarget)
    try {
      const created = await communityRequest<CommunityAmenity>(
        `/${activeCommunityId}/amenities`,
        accessToken,
        {
          name: formData.get('name'),
          description: formData.get('description'),
          location: formData.get('location'),
        },
      )
      setAmenities((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      )
      form.reset()
      setToast(`${created.name} is ready for bookings.`)
    } catch (error) {
      setAmenitiesError(
        error instanceof Error ? error.message : 'Unable to add this amenity.',
      )
    } finally {
      setAmenityBusy(false)
    }
  }

  const handleSetAmenityAvailability = async (
    amenityId: string,
    isActive: boolean,
  ) => {
    if (!accessToken || !activeCommunityId) return
    setAmenityBusy(true)
    setAmenitiesError('')
    try {
      const updated = await communityRequest<CommunityAmenity>(
        `/${activeCommunityId}/amenities/${amenityId}/availability`,
        accessToken,
        { isActive },
        'PATCH',
      )
      setAmenities((current) =>
        current.map((amenity) =>
          amenity.id === updated.id ? updated : amenity,
        ),
      )
      setToast(
        isActive
          ? `${updated.name} is available for booking.`
          : `${updated.name} is no longer available for new bookings.`,
      )
    } catch (error) {
      setAmenitiesError(
        error instanceof Error ? error.message : 'Unable to update amenity availability.',
      )
    } finally {
      setAmenityBusy(false)
    }
  }

  const handleCreateAmenityBooking = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!accessToken || !activeCommunityId) return
    setBookingBusy(true)
    setBookingError('')
    const formData = new FormData(event.currentTarget)
    try {
      const startsAt = new Date(String(formData.get('startsAt')))
      const endsAt = new Date(String(formData.get('endsAt')))
      if (
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(endsAt.getTime())
      ) {
        throw new Error('Choose a valid start and end time.')
      }
      const created = await communityRequest<AmenityBooking>(
        `/${activeCommunityId}/amenities/bookings`,
        accessToken,
        {
          amenityId: formData.get('amenityId'),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      )
      setAmenityBookings((current) =>
        [...current.filter((booking) => booking.id !== created.id), created].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
      )
      setModalType(null)
      setBookingAmenityId('')
      setToast(`${created.amenityName} booked successfully.`)
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : 'Unable to create this booking.',
      )
    } finally {
      setBookingBusy(false)
    }
  }

  const handleCancelAmenityBooking = async (bookingId: string) => {
    if (!accessToken || !activeCommunityId) return
    setBookingBusy(true)
    setBookingError('')
    try {
      const updated = await communityRequest<AmenityBooking>(
        `/${activeCommunityId}/amenities/bookings/${bookingId}/cancel`,
        accessToken,
        {},
      )
      setAmenityBookings((current) =>
        current.map((booking) =>
          booking.id === updated.id ? updated : booking,
        ),
      )
      setToast(`${updated.amenityName} booking cancelled.`)
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : 'Unable to cancel this booking.',
      )
    } finally {
      setBookingBusy(false)
    }
  }

  const handleSetSecurityRole = async (
    membershipId: string,
    enabled: boolean,
  ) => {
    if (!accessToken || !activeCommunityId) return
    setRoleUpdateBusy(true)
    setCommunityMembersError('')
    try {
      const updated = await communityRequest<CommunityMemberRole>(
        `/${activeCommunityId}/members/${membershipId}/security-role`,
        accessToken,
        { enabled },
        'PATCH',
      )
      setCommunityMembers((members) =>
        members.map((member) =>
          member.membershipId === updated.membershipId ? updated : member,
        ),
      )
      setToast(
        enabled
          ? `${updated.fullName} is now a security guard.`
          : `Security access removed for ${updated.fullName}.`,
      )
    } catch (error) {
      setCommunityMembersError(
        error instanceof Error ? error.message : 'Unable to update security access.',
      )
    } finally {
      setRoleUpdateBusy(false)
    }
  }

  const handleCreateServiceRequest = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!accessToken || !activeCommunityId) return
    setRequestBusy(true)
    setRequestError('')
    const formData = new FormData(event.currentTarget)
    try {
      const created = await communityRequest<CommunityServiceRequest>(
        `/${activeCommunityId}/requests`,
        accessToken,
        {
          title: formData.get('title'),
          category: formData.get('category'),
          location: formData.get('location'),
          description: formData.get('details'),
        },
      )
      requestsLoadSequence.current += 1
      setRequestsLoading(false)
      setCommunityRequests((current) => [
        created,
        ...current.filter((request) => request.id !== created.id),
      ])
      setModalType(null)
      setToast('Your request was submitted and added to your request list.')
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Unable to submit your request.',
      )
    } finally {
      setRequestBusy(false)
    }
  }

  const handleUpdateRequestStatus = async (
    requestId: string,
    status: ServiceRequestStatus,
    note?: string,
  ) => {
    if (!accessToken || !activeCommunityId) return
    setRequestStatusBusy(true)
    setRequestStatusError('')
    try {
      const updated = await communityRequest<CommunityServiceRequest>(
        `/${activeCommunityId}/requests/${requestId}/status`,
        accessToken,
        { status, ...(note?.trim() ? { note: note.trim() } : {}) },
        'PATCH',
      )
      setCommunityRequests((current) =>
        current.map((request) =>
          request.id === updated.id ? updated : request,
        ),
      )
      setToast(`Request marked ${requestStatusLabel(updated.status).toLowerCase()}.`)
    } catch (error) {
      setRequestStatusError(
        error instanceof Error ? error.message : 'Unable to update request status.',
      )
    } finally {
      setRequestStatusBusy(false)
    }
  }

  const handleCreateCommunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) return
    setAuthBusy(true)
    setCommunityStatus('loading')
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    try {
      await communityRequest<CommunityMembership>(
        '',
        accessToken,
        { name: formData.get('communityName') },
      )
      const { memberships, structure, activeCommunityId } = await loadCommunityState(accessToken)
      setCommunityMemberships(memberships)
      setCommunityStructure(structure)
      setActiveCommunityId(activeCommunityId)
      setCommunityStatus('ready')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create your community.')
      setCommunityStatus('error')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleRedeemInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken) return
    setAuthBusy(true)
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    try {
      const membership = await communityRequest<CommunityMembership>(
        '/invitations/redeem',
        accessToken,
        { code: formData.get('invitationCode') },
      )
      try {
        const { memberships, structure, activeCommunityId } =
          await loadCommunityState(accessToken, membership.community.id)
        setCommunityMemberships(memberships)
        setCommunityStructure(structure)
        setActiveCommunityId(activeCommunityId)
        setCommunityStatus('ready')
        setActivePage('Overview')
        setToast(`You joined ${membership.community.name} as a resident.`)
      } catch (error) {
        setCommunityMemberships((current) =>
          current.some(
            (item) => item.community.id === membership.community.id,
          )
            ? current
            : [...current, membership],
        )
        setActiveCommunityId(membership.community.id)
        setCommunityStatus('error')
        setAuthError(
          `Your invitation was accepted, but we couldn't load the community yet. Try again. ${
            error instanceof Error ? error.message : ''
          }`,
        )
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to redeem this invitation.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleCreateInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken || !invitationCommunityId) return
    setInvitationBusy(true)
    setInvitationError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      const invitation = await communityRequest<CreatedCommunityInvitation>(
        `/${invitationCommunityId}/invitations`,
        accessToken,
        { unitId: formData.get('unitId') },
      )
      setCreatedInvitation(invitation)
      form.reset()
      try {
        const invitations = await communityRequest<CommunityInvitation[]>(
          `/${invitationCommunityId}/invitations`,
          accessToken,
        )
        setCommunityInvitations(invitations)
      } catch (error) {
        setInvitationError(
          `The code was created, but invitation history could not be refreshed. ${
            error instanceof Error ? error.message : ''
          }`,
        )
      }
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : 'Unable to create this invitation.')
    } finally {
      setInvitationBusy(false)
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!accessToken || !invitationCommunityId) return
    setInvitationBusy(true)
    setInvitationError('')
    try {
      await communityRequest<{ revoked: true }>(
        `/${invitationCommunityId}/invitations/${invitationId}`,
        accessToken,
        undefined,
        'DELETE',
      )
      setCommunityInvitations((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? { ...invitation, revokedAt: new Date().toISOString(), status: 'REVOKED' }
            : invitation,
        ),
      )
    } catch (error) {
      setInvitationError(error instanceof Error ? error.message : 'Unable to revoke this invitation.')
    } finally {
      setInvitationBusy(false)
    }
  }

  const handleCopyInvitation = async () => {
    if (!createdInvitation) return
    try {
      await navigator.clipboard.writeText(createdInvitation.code)
      setToast('Invitation code copied.')
    } catch {
      setInvitationError('Could not copy the code. Select and copy it manually.')
    }
  }

  const handleCreateBlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!accessToken || !communityStructure) return
    setAuthBusy(true)
    setAuthError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      const block = await communityRequest<CommunityBlock>(
        `/${communityStructure.id}/blocks`,
        accessToken,
        {
          name: formData.get('blockName'),
          code: formData.get('blockCode'),
        },
      )
      setCommunityStructure((current) =>
        current
          ? { ...current, blocks: [...current.blocks, block].sort((a, b) => a.code.localeCompare(b.code)) }
          : current,
      )
      form.reset()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create this block.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleCreateUnit = async (
    blockId: string,
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (!accessToken || !communityStructure) return
    setAuthBusy(true)
    setAuthError('')
    const formData = new FormData(event.currentTarget)
    const form = event.currentTarget
    const floorValue = formData.get('floor')
    try {
      const unit = await communityRequest<CommunityUnit>(
        `/${communityStructure.id}/blocks/${blockId}/units`,
        accessToken,
        {
          number: formData.get('unitNumber'),
          ...(typeof floorValue === 'string' && floorValue !== ''
            ? { floor: Number(floorValue) }
            : {}),
        },
      )
      setCommunityStructure((current) =>
        current
          ? {
              ...current,
              blocks: current.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      units: [...block.units, unit].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
                    }
                  : block,
              ),
            }
          : current,
      )
      form.reset()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to add this apartment.')
    } finally {
      setAuthBusy(false)
    }
  }

  const retryCommunityLoad = () => {
    if (!accessToken) return
    setAuthError('')
    setCommunityStatus('loading')
    loadCommunityState(accessToken, activeCommunityId)
      .then(({ memberships, structure, activeCommunityId }) => {
        setCommunityMemberships(memberships)
        setCommunityStructure(structure)
        setActiveCommunityId(activeCommunityId)
        setCommunityStatus('ready')
      })
      .catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : 'Unable to load your community.')
        setCommunityStatus('error')
      })
  }

  if (authLoading) {
    return <div className="auth-loading" role="status">Checking your saved CommunityOS session…</div>
  }

  if (!authUser || !accessToken) {
    return (
      <AuthScreen
        mode={authMode}
        busy={authBusy}
        error={authError}
        onModeChange={(mode) => { setAuthMode(mode); setAuthError('') }}
        onSubmit={handleAuthSubmit}
      />
    )
  }

  if (communityStatus === 'loading') {
    return <div className="auth-loading" role="status">Opening your community…</div>
  }

  if (communityStatus === 'error') {
    return <CommunitySetupScreen
      busy={authBusy}
      error={authError}
      onRetry={retryCommunityLoad}
      onLogout={handleLogout}
    />
  }

  if (communityMemberships.length === 0) {
    return <CommunitySetupScreen
      busy={authBusy}
      error={authError}
      onSubmit={handleCreateCommunity}
      onJoin={handleRedeemInvitation}
      onLogout={handleLogout}
    />
  }

  const activeMembership =
    communityMemberships.find(
      (membership) => membership.community.id === activeCommunityId,
    ) ?? communityMemberships[0]
  const activeCommunity = activeMembership.community.name
  const isAdministrator = activeMembership.roles.includes('ADMINISTRATOR')
  const canManageRequests =
    isAdministrator || activeMembership.roles.includes('MAINTENANCE_STAFF')
  const canManageVisitors =
    isAdministrator || activeMembership.roles.includes('SECURITY_GUARD')
  const today = new Date()
  const visitorsToday = visitorPasses.filter((pass) => {
    const arrival = new Date(pass.expectedAt)
    return (
      arrival.getFullYear() === today.getFullYear() &&
      arrival.getMonth() === today.getMonth() &&
      arrival.getDate() === today.getDate()
    )
  }).length
  const checkedInVisitorsToday = visitorPasses.filter((pass) => {
    const checkIn = pass.checkedInAt ? new Date(pass.checkedInAt) : null
    return (
      checkIn !== null &&
      checkIn.getFullYear() === today.getFullYear() &&
      checkIn.getMonth() === today.getMonth() &&
      checkIn.getDate() === today.getDate()
    )
  }).length
  const expectedVisitorsToday = visitorPasses.filter((pass) => {
    const arrival = new Date(pass.expectedAt)
    return (
      pass.status === 'EXPECTED' &&
      arrival.getFullYear() === today.getFullYear() &&
      arrival.getMonth() === today.getMonth() &&
      arrival.getDate() === today.getDate()
    )
  }).length
  const unresolvedRequestCount = communityRequests.filter(
    (request) => request.status !== 'RESOLVED',
  ).length
  const upcomingAmenityBookings = amenityBookings.filter(
    (booking) =>
      booking.isMine &&
      booking.status === 'CONFIRMED' &&
      new Date(booking.startsAt).getTime() > Date.now(),
  )
  const hasApartments = communityStructure?.blocks.some((block) => block.units.length > 0) ?? false
  const communityNavigation = isAdministrator
    ? [
        ...navigation.slice(1),
        { label: 'Blocks & homes', icon: 'building' as const },
        { label: 'Invitations', icon: 'key' as const },
        { label: 'Security team', icon: 'door' as const },
      ]
    : navigation.slice(1)
  const firstName = authUser.fullName.trim().split(/\s+/)[0] || authUser.fullName
  const initials = authUser.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={() => goTo('Overview')}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">community<span>OS</span></span>
        </a>

        <button className="community-switcher" type="button" aria-expanded={communityMenuOpen} onClick={() => setCommunityMenuOpen(!communityMenuOpen)}>
          <span className="community-avatar"><Icon name="building" size={19} /></span>
          <span className="community-details">
            <span className="community-caption">YOUR COMMUNITY</span>
            <span className="community-title">{activeCommunity} <Icon name="chevron" size={15} /></span>
          </span>
        </button>
        {communityMenuOpen && (
          <div className="community-menu">
            {communityMemberships.map((membership) => (
              <button key={membership.community.id} type="button" onClick={() => handleSelectCommunity(membership.community.id)}>
                <span className="community-option-icon"><Icon name="building" size={15} /></span>
                {membership.community.name}
                {activeCommunityId === membership.community.id && <Icon name="check" size={15} />}
              </button>
            ))}
            <button type="button" onClick={() => {
              setCommunityMenuOpen(false)
              goTo('Join a community')
            }}>
              <span className="community-option-icon"><Icon name="plus" size={15} /></span>
              Join a community
              </button>
          </div>
        )}

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-label">HOME</span>
          {navigation.slice(0, 1).map((item) => (
            <NavItem key={item.label} item={item} active={activePage === item.label} onClick={goTo} requestCount={unresolvedRequestCount} />
          ))}
          <span className="nav-label nav-label-spaced">YOUR COMMUNITY</span>
          {communityNavigation.filter((item) => !['Blocks & homes', 'Invitations', 'Security team'].includes(item.label)).map((item) => (
            <NavItem key={item.label} item={item} active={activePage === item.label} onClick={goTo} requestCount={unresolvedRequestCount} />
          ))}
          {isAdministrator && (
            <>
              <span className="nav-label nav-label-spaced">ADMINISTRATION</span>
              <NavItem
                item={{ label: 'Blocks & homes', icon: 'building' }}
                active={activePage === 'Blocks & homes'}
                onClick={goTo}
                requestCount={unresolvedRequestCount}
              />
              <NavItem
                item={{ label: 'Invitations', icon: 'key' }}
                active={activePage === 'Invitations'}
                onClick={goTo}
                requestCount={unresolvedRequestCount}
              />
              <NavItem
                item={{ label: 'Security team', icon: 'door' }}
                active={activePage === 'Security team'}
                onClick={goTo}
                requestCount={unresolvedRequestCount}
              />
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Icon name="help" size={18} /></div>
            <p>Need a hand?</p>
            <span>We’re here to help you.</span>
            <button type="button" onClick={() => goTo('Help & support')}>Visit help center <Icon name="arrow" size={13} /></button>
          </div>
          <button className="profile-button" type="button" onClick={() => goTo('My profile')}>
            <span className="avatar avatar-profile">{initials}</span>
            <span className="profile-copy"><strong>{authUser.fullName}</strong><span>{isAdministrator ? 'Community administrator' : 'Community member'}</span></span>
            <Icon name="more" size={18} />
          </button>
          <button className="sign-out-button" type="button" disabled={authBusy} onClick={handleLogout}>
            <Icon name="door" size={15} /> {authBusy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span>{activeCommunity}</span><span className="breadcrumb-separator">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            {searchOpen ? (
              <div className="search-wrap">
                <Icon name="search" size={16} />
                <input className="search-input" autoFocus aria-label="Search community" placeholder="Search requests & updates..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchQuery(''); setSearchOpen(false) } }} />
                {searchQuery && <button className="search-clear" aria-label="Clear search" onClick={() => setSearchQuery('')}><Icon name="close" size={14} /></button>}
              </div>
            ) : (
              <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(true)}><Icon name="search" /></button>
            )}
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Icon name="bell" />{hasUnreadNotifications && <span />}</button>
              {notificationsOpen && (
                <section className="notification-popover" aria-label="Notifications">
                  <div className="notification-popover-head"><div><span className="section-kicker">YOUR COMMUNITY</span><h2>Little updates</h2></div><button onClick={() => setHasUnreadNotifications(false)}>Mark all read</button></div>
                  <button className="notification-item" onClick={() => { setNotificationsOpen(false); goTo('Announcements') }}><span className="notification-item-icon notification-purple"><Icon name="megaphone" size={16} /></span><span><strong>Something new in Block A</strong><small>Water tank cleaning this Saturday · 2h ago</small></span><i /></button>
                  <button className="notification-item" onClick={() => { setNotificationsOpen(false); goTo('My requests') }}><span className="notification-item-icon notification-green"><Icon name="inbox" size={16} /></span><span><strong>Your repair is moving along</strong><small>Water pressure request updated · 4h ago</small></span><i /></button>
                  <p className="notification-demo-note">Preview notifications · sample data</p>
                </section>
              )}
            </div>
            <span className="topbar-divider" />
            <button className="topbar-profile" type="button" onClick={() => goTo('My profile')}><span className="avatar avatar-profile">{initials}</span><span>{firstName}</span><Icon name="chevron" size={15} /></button>
          </div>
        </header>

        {activePage === 'Join a community' ? (
          <JoinCommunityScreen
            busy={authBusy}
            error={authError}
            onSubmit={handleRedeemInvitation}
            onCancel={() => goTo('Overview')}
          />
        ) : isAdministrator && communityStructure && (!hasApartments || activePage === 'Blocks & homes') ? (
          <BuildingSetupScreen
            communityName={activeCommunity}
            blocks={communityStructure.blocks}
            busy={authBusy}
            error={authError}
            canContinue={hasApartments}
            onCreateBlock={handleCreateBlock}
            onCreateUnit={handleCreateUnit}
            onContinue={() => goTo('Overview')}
            onLogout={handleLogout}
          />
        ) : isAdministrator && activePage === 'Security team' ? (
          <SecurityTeamScreen
            members={communityMembers}
            loading={communityMembersLoading}
            error={communityMembersError}
            busy={roleUpdateBusy}
            onRoleChange={handleSetSecurityRole}
          />
        ) : isAdministrator && activePage === 'Invitations' && communityStructure ? (
          <InvitationManagementScreen
            blocks={communityStructure.blocks}
            invitations={communityInvitations}
            loading={invitationsLoading}
            busy={invitationBusy}
            error={invitationError}
            createdInvitation={createdInvitation}
            onCreate={handleCreateInvitation}
            onRevoke={handleRevokeInvitation}
            onCopy={handleCopyInvitation}
            onDismissCode={() => setCreatedInvitation(null)}
          />
        ) : activePage === 'My requests' ? (
          <MyRequestsScreen
            requests={communityRequests}
            loading={requestsLoading}
            error={requestError}
            statusError={requestStatusError}
            canManageRequests={canManageRequests}
            statusBusy={requestStatusBusy}
            onStatusUpdate={handleUpdateRequestStatus}
            onNewRequest={() => setModalType('request')}
          />
        ) : activePage === 'Visitor log' ? (
          <VisitorLogScreen
            passes={visitorPasses}
            loading={visitorPassesLoading}
            error={visitorPassesError || visitorError}
            unitsLoading={visitorUnitsLoading}
            canCreatePass={visitorUnits.length > 0}
            canManageVisitors={canManageVisitors}
            statusBusy={visitorStatusBusy}
            onCreatePass={() => setModalType('visitor')}
            onUpdateStatus={handleUpdateVisitorStatus}
          />
        ) : activePage === 'Amenities' ? (
          <AmenitiesScreen
            amenities={amenities}
            bookings={amenityBookings}
            loading={amenitiesLoading}
            error={amenitiesError || bookingError}
            canManage={isAdministrator}
            busy={amenityBusy || bookingBusy}
            onCreateAmenity={handleCreateAmenity}
            onSetAvailability={handleSetAmenityAvailability}
            onBook={(amenityId) => openAmenityBooking(amenityId)}
            onCancelBooking={handleCancelAmenityBooking}
          />
        ) : activePage === 'Overview' ? (
          <Dashboard
            requests={communityRequests}
            requestsLoading={requestsLoading}
            requestsError={requestError}
            requestStatusError={requestStatusError}
            canManageRequests={canManageRequests}
            requestStatusBusy={requestStatusBusy}
            onStatusUpdate={handleUpdateRequestStatus}
            showAllRequests={showAllRequests}
            setShowAllRequests={setShowAllRequests}
            showAllAnnouncements={showAllAnnouncements}
            setShowAllAnnouncements={setShowAllAnnouncements}
            searchQuery={searchQuery}
            firstName={firstName}
            communityName={activeCommunity}
            visitorsToday={visitorsToday}
            checkedInVisitorsToday={checkedInVisitorsToday}
            expectedVisitorsToday={expectedVisitorsToday}
            visitorsLoading={visitorPassesLoading}
            visitorsError={visitorPassesError}
            amenityBookings={upcomingAmenityBookings}
            amenitiesLoading={amenitiesLoading}
            amenitiesError={amenitiesError}
            goTo={goTo}
            openAction={(type) =>
              type === 'booking'
                ? openAmenityBooking()
                : setModalType(type)
            }
          />
        ) : (
          <section className="coming-soon">
            <span className="coming-icon"><Icon name={navigation.find((item) => item.label === activePage)?.icon ?? 'help'} size={25} /></span>
            <p className="eyebrow">COMMUNITYOS</p>
            <h1>{activePage}</h1>
            <p>This space is being prepared. We’ll connect it to the CommunityOS backend as we build each feature.</p>
            <button className="button button-primary" onClick={() => goTo('Overview')}>Back to overview</button>
          </section>
        )}
        <footer className="page-footer"><span>Made for better communities</span><span>CommunityOS <span className="footer-dot">·</span> Resident portal</span></footer>
      </main>
      {modalType && (
        <ActionModal
          type={modalType}
          onClose={() => {
            setModalType(null)
            setRequestError('')
            setVisitorError('')
            setBookingError('')
            setBookingAmenityId('')
          }}
          busy={
            modalType === 'request'
              ? requestBusy
              : modalType === 'visitor'
                ? visitorBusy
                : bookingBusy
          }
          error={
            modalType === 'request'
              ? requestError
              : modalType === 'visitor'
                ? visitorError
                : bookingError
          }
          visitorUnits={visitorUnits}
          visitorUnitsLoading={visitorUnitsLoading}
          amenities={amenities.filter((amenity) => amenity.isActive)}
          selectedAmenityId={bookingAmenityId}
          onSubmit={
            modalType === 'request'
              ? handleCreateServiceRequest
              : modalType === 'visitor'
                ? handleCreateVisitorPass
                : handleCreateAmenityBooking
          }
        />
      )}
      {authError && <div className="auth-global-error" role="alert">{authError}</div>}
      {toast && <div className="toast-message" role="status"><Icon name="check" size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={15} /></button></div>}
    </div>
  )
}

function AuthScreen({
  mode,
  busy,
  error,
  onModeChange,
  onSubmit,
}: {
  mode: 'login' | 'signup'
  busy: boolean
  error: string
  onModeChange: (mode: 'login' | 'signup') => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const signingUp = mode === 'signup'
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">community<span>OS</span></span>
        </div>
        <div className="auth-art" aria-hidden="true">
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <span className="auth-art-sun" />
          <span className="auth-art-building"><i /><i /><i /><i /><i /><i /></span>
          <span className="auth-art-ground" />
        </div>
        <div className="auth-content">
          <p className="eyebrow">{signingUp ? 'YOUR COMMUNITY, ONE PLACE' : 'WELCOME BACK TO YOUR COMMUNITY'}</p>
          <h1>{signingUp ? 'Make yourself at home.' : 'Good to see you again.'}</h1>
          <p className="auth-subtitle">{signingUp ? 'Create your account to get started with CommunityOS.' : 'Sign in to pick up right where you left off.'}</p>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!signingUp} className={!signingUp ? 'auth-tab-active' : ''} onClick={() => onModeChange('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={signingUp} className={signingUp ? 'auth-tab-active' : ''} onClick={() => onModeChange('signup')}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            {signingUp && (
              <label>Full name
                <input name="fullName" type="text" autoComplete="name" required minLength={1} maxLength={120} placeholder="Your name" />
              </label>
            )}
            <label>Email address
              <input name="email" type="email" autoComplete="email" required maxLength={320} placeholder="you@example.com" />
            </label>
            <label>Password
              <input name="password" type="password" autoComplete={signingUp ? 'new-password' : 'current-password'} required minLength={signingUp ? 12 : 1} maxLength={72} placeholder={signingUp ? 'At least 12 characters' : 'Your password'} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : signingUp ? 'Create my account' : 'Sign in'}
              {!busy && <Icon name="arrow" size={17} />}
            </button>
          </form>
          <p className="auth-security-note"><Icon name="check" size={15} /> Your account is stored securely in the CommunityOS database.</p>
          {signingUp && <p className="auth-password-note">Use at least 12 characters. Your password is stored as a one-way hash, never as readable text.</p>}
        </div>
      </section>
      <p className="auth-footer">A brighter way to feel at home <span>·</span> CommunityOS</p>
    </main>
  )
}

function CommunitySetupScreen({
  busy,
  error,
  onSubmit,
  onJoin,
  onRetry,
  onLogout,
}: {
  busy: boolean
  error: string
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  onJoin?: (event: FormEvent<HTMLFormElement>) => void
  onRetry?: () => void
  onLogout: () => void
}) {
  const [joinMode, setJoinMode] = useState(false)
  const retrying = !onSubmit
  return (
    <main className="auth-screen">
      <section className="community-setup-card">
        <div className="auth-brand">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">community<span>OS</span></span>
        </div>
        <span className="community-setup-icon"><Icon name="building" size={25} /></span>
        <p className="eyebrow">YOUR COMMUNITY STARTS HERE</p>
        <h1>{retrying ? 'We couldn’t load your community.' : joinMode ? 'Join your community.' : 'Create your community.'}</h1>
        <p className="community-setup-copy">
          {retrying
            ? 'Check your connection and try again. Your account is safe.'
            : joinMode
              ? 'Enter the one-time code your community administrator shared with you.'
              : 'Set up the place you manage, or join one with an administrator invitation.'}
        </p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {onSubmit ? (
          <>
            {onJoin && (
              <div className="setup-mode-tabs" role="tablist" aria-label="Community access">
                <button type="button" role="tab" aria-selected={!joinMode} className={!joinMode ? 'setup-mode-active' : ''} onClick={() => setJoinMode(false)}>Create community</button>
                <button type="button" role="tab" aria-selected={joinMode} className={joinMode ? 'setup-mode-active' : ''} onClick={() => setJoinMode(true)}>Join with a code</button>
              </div>
            )}
            {joinMode ? (
              <form className="auth-form community-setup-form" onSubmit={onJoin}>
                <label>Invitation code
                  <input name="invitationCode" type="text" required minLength={32} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="AB12-CD34-EF56-…" />
                </label>
                <button className="auth-submit" type="submit" disabled={busy}>
                  {busy ? 'Joining community…' : 'Join community'}
                  {!busy && <Icon name="arrow" size={17} />}
                </button>
              </form>
            ) : (
              <>
                <form className="auth-form community-setup-form" onSubmit={onSubmit}>
                  <label>Community name
                    <input name="communityName" type="text" required minLength={1} maxLength={160} placeholder="e.g. Maple Grove Residences" />
                  </label>
                  <button className="auth-submit" type="submit" disabled={busy}>
                    {busy ? 'Creating community…' : 'Create community'}
                    {!busy && <Icon name="arrow" size={17} />}
                  </button>
                </form>
                <p className="auth-password-note">Creating a community makes your account its first administrator. You can also join as a resident with an invitation code.</p>
              </>
            )}
          </>
        ) : (
          <button className="auth-submit community-retry" type="button" disabled={busy} onClick={onRetry}>Try again</button>
        )}
        <button className="community-setup-signout" type="button" disabled={busy} onClick={onLogout}>Sign out</button>
      </section>
      <p className="auth-footer">A brighter way to feel at home <span>·</span> CommunityOS</p>
    </main>
  )
}

function JoinCommunityScreen({
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  busy: boolean
  error: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  return (
    <section className="auth-screen join-community-screen">
      <div className="community-setup-card">
        <span className="community-setup-icon"><Icon name="key" size={24} /></span>
        <p className="eyebrow">A NEW PLACE TO CALL HOME</p>
        <h1>Join with an invitation.</h1>
        <p className="community-setup-copy">Enter the one-time code shared by your community administrator. It is linked to your apartment and expires after seven days.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form className="auth-form community-setup-form" onSubmit={onSubmit}>
          <label>Invitation code
            <input name="invitationCode" type="text" required minLength={32} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="AB12-CD34-EF56-…" />
          </label>
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Joining community…' : 'Join community'}
            {!busy && <Icon name="arrow" size={17} />}
          </button>
        </form>
        <button className="community-setup-signout" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  )
}

function InvitationManagementScreen({
  blocks,
  invitations,
  loading,
  busy,
  error,
  createdInvitation,
  onCreate,
  onRevoke,
  onCopy,
  onDismissCode,
}: {
  blocks: CommunityBlock[]
  invitations: CommunityInvitation[]
  loading: boolean
  busy: boolean
  error: string
  createdInvitation: CreatedCommunityInvitation | null
  onCreate: (event: FormEvent<HTMLFormElement>) => void
  onRevoke: (invitationId: string) => void
  onCopy: () => void
  onDismissCode: () => void
}) {
  const units = blocks.flatMap((block) =>
    block.units.map((unit) => ({
      ...unit,
      blockName: block.name,
      blockCode: block.code,
    })),
  )
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <section className="invitation-page">
      <header className="invitation-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION · RESIDENT ACCESS</p>
          <h1>Invite your neighbors.</h1>
          <p>Create a one-time code for a specific apartment. Share it directly with the resident; it expires in seven days.</p>
        </div>
        <span className="invitation-heading-icon"><Icon name="key" size={24} /></span>
      </header>

      {error && <p className="auth-error invitation-error" role="alert">{error}</p>}

      {createdInvitation && (
        <section className="invitation-code-reveal" aria-live="polite">
          <div>
            <span className="section-kicker">SHARE THIS CODE NOW</span>
            <p>This code is shown only once. It is valid for seven days and can be redeemed by one account.</p>
            <code>{createdInvitation.code}</code>
          </div>
          <div className="invitation-code-actions">
            <button className="button button-primary" type="button" onClick={onCopy}><Icon name="check" size={16} /> Copy code</button>
            <button className="invitation-dismiss" type="button" onClick={onDismissCode}>Done</button>
          </div>
        </section>
      )}

      <section className="invitation-create-card">
        <div>
          <p className="section-kicker">NEW INVITATION</p>
          <h2>Choose an apartment</h2>
          <p>Each code is single-use and grants resident access to the selected home.</p>
        </div>
        <form className="invitation-create-form" onSubmit={onCreate}>
          <label htmlFor="invitation-unit">Apartment</label>
          <select id="invitation-unit" name="unitId" required disabled={busy || units.length === 0} defaultValue="">
            <option value="" disabled>{units.length ? 'Select an apartment' : 'Add an apartment first'}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.blockName} · {unit.blockCode} · Apartment {unit.number}
              </option>
            ))}
          </select>
          <button className="button button-primary" type="submit" disabled={busy || units.length === 0}>
            <Icon name="plus" size={16} /> {busy ? 'Working…' : 'Create invite code'}
          </button>
        </form>
      </section>

      <section className="invitation-list-section">
        <div className="invitation-list-heading">
          <div><p className="section-kicker">INVITATION HISTORY</p><h2>Codes for your community</h2></div>
          <span className="invitation-count">{invitations.length}</span>
        </div>
        {loading ? (
          <p className="invitation-empty" role="status">Loading invitation history…</p>
        ) : invitations.length === 0 ? (
          <p className="invitation-empty">No invitations yet. Create a code above to welcome your first resident.</p>
        ) : (
          <div className="invitation-list">
            {invitations.map((invitation) => (
              <article className="invitation-row" key={invitation.id}>
                <span className="invitation-row-icon"><Icon name="building" size={17} /></span>
                <div className="invitation-row-details">
                  <strong>{invitation.unit.block.name} · {invitation.unit.block.code} / {invitation.unit.number}</strong>
                  <span>Created {dateFormatter.format(new Date(invitation.createdAt))}</span>
                  <small>{invitation.status === 'REDEEMED' ? `Used ${invitation.redeemedAt ? dateFormatter.format(new Date(invitation.redeemedAt)) : ''}` : `Expires ${dateFormatter.format(new Date(invitation.expiresAt))}`}</small>
                </div>
                <span className={`invitation-status invitation-status-${invitation.status.toLowerCase()}`}>{invitation.status.toLowerCase()}</span>
                {invitation.status === 'ACTIVE' && (
                  <button className="invitation-revoke" type="button" disabled={busy} onClick={() => onRevoke(invitation.id)}>Revoke</button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function BuildingSetupScreen({
  communityName,
  blocks,
  busy,
  error,
  canContinue,
  onCreateBlock,
  onCreateUnit,
  onContinue,
  onLogout,
}: {
  communityName: string
  blocks: CommunityBlock[]
  busy: boolean
  error: string
  canContinue: boolean
  onCreateBlock: (event: FormEvent<HTMLFormElement>) => void
  onCreateUnit: (blockId: string, event: FormEvent<HTMLFormElement>) => void
  onContinue: () => void
  onLogout: () => void
}) {
  const apartmentCount = blocks.reduce((count, block) => count + block.units.length, 0)
  return (
    <section className="building-setup-page">
      <section className="building-setup-card">
        <div className="building-setup-heading">
          <span className="community-setup-icon"><Icon name="building" size={25} /></span>
          <p className="eyebrow">COMMUNITY SETUP · {communityName.toUpperCase()}</p>
          <h1>Let’s map out your homes.</h1>
          <p className="community-setup-copy">Add your building blocks and apartment numbers. This helps your community stay organized.</p>
          <div className="setup-progress"><span style={{ width: canContinue ? '100%' : blocks.length ? '55%' : '20%' }} /></div>
          <p className="setup-progress-copy">{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} <span>·</span> {apartmentCount} {apartmentCount === 1 ? 'apartment' : 'apartments'} added</p>
        </div>

        {error && <p className="auth-error building-setup-error" role="alert">{error}</p>}

        {blocks.length > 0 && (
          <div className="building-list">
            {blocks.map((block) => (
              <article className="building-card" key={block.id}>
                <div className="building-card-heading">
                  <span className="building-card-icon"><Icon name="building" size={18} /></span>
                  <div>
                    <h2>{block.name}</h2>
                    <p>Block {block.code} <span>·</span> {block.units.length} {block.units.length === 1 ? 'apartment' : 'apartments'}</p>
                  </div>
                </div>
                {block.units.length > 0 && (
                  <ul className="apartment-list">
                    {block.units.map((unit) => (
                      <li key={unit.id}>
                        <span>{unit.number}</span>
                        {unit.floor !== null && <small>Floor {unit.floor}</small>}
                      </li>
                    ))}
                  </ul>
                )}
                <form className="apartment-form" onSubmit={(event) => onCreateUnit(block.id, event)}>
                  <label>Apartment number
                    <input name="unitNumber" type="text" required maxLength={32} placeholder="e.g. 204" />
                  </label>
                  <label>Floor <span className="optional-label">optional</span>
                    <input name="floor" type="number" min={-5} max={300} step={1} placeholder="e.g. 2" />
                  </label>
                  <button className="setup-add-button" type="submit" disabled={busy} aria-label={`Add apartment to ${block.name}`}>
                    <Icon name="plus" size={18} />
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}

        <section className="new-block-section">
          <div className="new-block-heading">
            <span className="section-kicker">BUILDING BLOCKS</span>
            <h2>{blocks.length ? 'Add another block' : 'Start with your first block'}</h2>
          </div>
          <form className="new-block-form" onSubmit={onCreateBlock}>
            <label>Block name
              <input name="blockName" type="text" required maxLength={120} placeholder="e.g. Tower A" />
            </label>
            <label>Block code
              <input name="blockCode" type="text" required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9-]*" title="Use letters, numbers, and hyphens." placeholder="e.g. A" />
            </label>
            <button className="setup-add-button" type="submit" disabled={busy} aria-label="Add block">
              <Icon name="plus" size={18} />
            </button>
          </form>
        </section>

        <div className="building-setup-actions">
          <button className="auth-submit" type="button" disabled={!canContinue || busy} onClick={onContinue}>
            {canContinue ? 'Continue to your dashboard' : 'Add at least one apartment to continue'}
            {canContinue && <Icon name="arrow" size={17} />}
          </button>
          <button className="community-setup-signout" type="button" disabled={busy} onClick={onLogout}>Sign out</button>
        </div>
      </section>
    </section>
  )
}

function NavItem({
  item,
  active,
  onClick,
  requestCount,
}: {
  item: { label: string; icon: IconName }
  active: boolean
  onClick: (page: string) => void
  requestCount: number
}) {
  return (
    <button className={`nav-item ${active ? 'nav-item-active' : ''}`} type="button" onClick={() => onClick(item.label)}>
      <Icon name={item.icon} size={19} />
      <span>{item.label}</span>
      {item.label === 'My requests' && requestCount > 0 && <span className="nav-count">{requestCount}</span>}
    </button>
  )
}

function requestStatusLabel(status: ServiceRequestStatus): string {
  if (status === 'IN_PROGRESS') return 'In progress'
  if (status === 'RESOLVED') return 'Resolved'
  return 'Open'
}

function requestStatusTone(status: ServiceRequestStatus): string {
  if (status === 'IN_PROGRESS') return 'progress'
  if (status === 'RESOLVED') return 'resolved'
  return 'open'
}

function relativeTime(date: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Submitted just now'
  if (minutes < 60) return `Submitted ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Submitted ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Submitted ${days}d ago`
  return `Submitted ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date))}`
}

function ServiceRequestRows({
  requests,
  loading,
  error,
  emptyMessage,
  canManageRequests = false,
  statusBusy = false,
  onStatusUpdate,
}: {
  requests: CommunityServiceRequest[]
  loading: boolean
  error: string
  emptyMessage: string
  canManageRequests?: boolean
  statusBusy?: boolean
  onStatusUpdate?: (
    requestId: string,
    status: ServiceRequestStatus,
    note?: string,
  ) => void
}) {
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({})

  if (loading) {
    return <p className="empty-search" role="status">Loading your requests…</p>
  }
  if (error) {
    return <p className="auth-error request-list-error" role="alert">{error}</p>
  }
  if (requests.length === 0) {
    return <p className="empty-search">{emptyMessage}</p>
  }

  return (
    <div className="request-list">
      {requests.map((request) => {
        const initials = request.creatorName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('')
        const status = requestStatusLabel(request.status)
        const nextStatus =
          request.status === 'OPEN'
            ? 'IN_PROGRESS'
            : request.status === 'IN_PROGRESS'
              ? 'RESOLVED'
              : null
        return (
          <article className="request-row" key={request.id}>
            <span className="request-avatar avatar-lavender">{initials}</span>
            <div className="request-info">
              <h3>{request.title}</h3>
              <p>{request.category.toLowerCase()} · {request.location}</p>
            </div>
            <div className="request-status">
              <span className={`status-pill status-${requestStatusTone(request.status)}`}><span />{status}</span>
              <span className="request-updated">{relativeTime(request.updatedAt)}</span>
              {canManageRequests && nextStatus && onStatusUpdate && (
                <>
                  <input
                    className="request-status-note"
                    type="text"
                    maxLength={500}
                    disabled={statusBusy}
                    aria-label={`Optional status update note for ${request.title}`}
                    placeholder="Add an optional note"
                    value={statusNotes[request.id] ?? ''}
                    onChange={(event) =>
                      setStatusNotes((current) => ({
                        ...current,
                        [request.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="request-status-action"
                    type="button"
                    disabled={statusBusy}
                    onClick={() =>
                      onStatusUpdate(
                        request.id,
                        nextStatus,
                        statusNotes[request.id],
                      )
                    }
                  >
                    {statusBusy
                      ? 'Updating…'
                      : nextStatus === 'IN_PROGRESS'
                        ? 'Start progress'
                        : 'Mark resolved'}
                  </button>
                </>
              )}
            </div>
            <details className="request-history">
              <summary>Status history</summary>
              <ol>
                <li>
                  <span className="request-history-dot" />
                  <div>
                    <strong>Request submitted</strong>
                    <span>{request.creatorName} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.createdAt))}</span>
                  </div>
                </li>
                {request.statusHistory.map((update) => (
                  <li key={update.id}>
                    <span className="request-history-dot" />
                    <div>
                      <strong>{requestStatusLabel(update.status)}</strong>
                      <span>{update.updatedByName} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(update.createdAt))}</span>
                      {update.note && <p>{update.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </article>
        )
      })}
    </div>
  )
}

function MyRequestsScreen({
  requests,
  loading,
  error,
  statusError,
  canManageRequests,
  statusBusy,
  onStatusUpdate,
  onNewRequest,
}: {
  requests: CommunityServiceRequest[]
  loading: boolean
  error: string
  statusError: string
  canManageRequests: boolean
  statusBusy: boolean
  onStatusUpdate: (
    requestId: string,
    status: ServiceRequestStatus,
    note?: string,
  ) => void
  onNewRequest: () => void
}) {
  return (
    <section className="my-requests-page">
      <header className="my-requests-heading">
        <div>
          <p className="eyebrow">YOUR COMMUNITY · SERVICE DESK</p>
          <h1>My requests</h1>
          <p>Keep track of issues you’ve reported to your community team.</p>
        </div>
        <button className="button button-primary" type="button" onClick={onNewRequest}>
          <Icon name="plus" size={16} /> New request
        </button>
      </header>
      <section className="panel my-requests-panel">
        <div className="panel-heading">
          <div><p className="section-kicker">REPAIR TRACKER</p><h2>Your submitted requests</h2></div>
          <span className="heading-count">{requests.length.toString().padStart(2, '0')}</span>
        </div>
        <ServiceRequestRows
          requests={requests}
          loading={loading}
          error={error}
          emptyMessage="No requests yet. Report an issue and it will show up here."
          canManageRequests={canManageRequests}
          statusBusy={statusBusy}
          onStatusUpdate={onStatusUpdate}
        />
        {statusError && <p className="auth-error request-list-error" role="alert">{statusError}</p>}
      </section>
    </section>
  )
}

function visitorStatusLabel(status: VisitorPassStatus): string {
  if (status === 'CHECKED_IN') return 'Checked in'
  if (status === 'CHECKED_OUT') return 'Checked out'
  return 'Expected'
}

function visitorPurposeLabel(purpose: VisitorPurpose): string {
  if (purpose === 'PERSONAL_VISIT') return 'Personal visit'
  if (purpose === 'DELIVERY') return 'Delivery'
  return 'Service / maintenance'
}

function VisitorLogScreen({
  passes,
  loading,
  error,
  unitsLoading,
  canCreatePass,
  canManageVisitors,
  statusBusy,
  onCreatePass,
  onUpdateStatus,
}: {
  passes: VisitorPass[]
  loading: boolean
  error: string
  unitsLoading: boolean
  canCreatePass: boolean
  canManageVisitors: boolean
  statusBusy: boolean
  onCreatePass: () => void
  onUpdateStatus: (passId: string, status: VisitorPassStatus) => void
}) {
  return (
    <section className="visitor-page">
      <header className="my-requests-heading">
        <div>
          <p className="eyebrow">YOUR COMMUNITY · FRONT DESK</p>
          <h1>Visitor log</h1>
          <p>Register an expected guest and keep track of their visit.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={onCreatePass}
          disabled={unitsLoading || !canCreatePass}
        >
          <Icon name="plus" size={16} /> Create visitor pass
        </button>
      </header>

      {error && <p className="auth-error request-list-error" role="alert">{error}</p>}
      {!unitsLoading && !canCreatePass && (
        <p className="visitor-unit-help">
          Your account needs an apartment linked by a community administrator before you can create visitor passes.
        </p>
      )}
      <section className="panel visitor-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">
              {canManageVisitors ? 'COMMUNITY ARRIVALS' : 'YOUR GUESTS'}
            </p>
            <h2>Visitor passes</h2>
          </div>
          <span className="heading-count">{passes.length.toString().padStart(2, '0')}</span>
        </div>
        {loading ? (
          <p className="empty-search" role="status">Loading visitor passes…</p>
        ) : passes.length === 0 ? (
          <p className="empty-search">No visitor passes yet. Create one when you’re expecting a guest.</p>
        ) : (
          <div className="visitor-list">
            {passes.map((pass) => {
              const nextStatus =
                pass.status === 'EXPECTED'
                  ? 'CHECKED_IN'
                  : pass.status === 'CHECKED_IN'
                    ? 'CHECKED_OUT'
                    : null
              return (
                <article className="visitor-pass-card" key={pass.id}>
                  <span className="visitor-pass-icon"><Icon name="door" size={19} /></span>
                  <div className="visitor-pass-main">
                    <div className="visitor-pass-heading">
                      <h3>{pass.visitorName}</h3>
                      <span className={`visitor-pass-status visitor-pass-${pass.status.toLowerCase().replace('_', '-')}`}>
                        {visitorStatusLabel(pass.status)}
                      </span>
                    </div>
                    <p>
                      {pass.unit.block.name} · Apartment {pass.unit.number}
                      {' · '}{visitorPurposeLabel(pass.purpose)}
                    </p>
                    <p>
                      Host: {pass.hostName}
                      {' · Arriving '}
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(pass.expectedAt))}
                    </p>
                    {pass.checkedInAt && (
                      <p>
                        Checked in {new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(pass.checkedInAt))}
                        {pass.checkedInByName ? ` by ${pass.checkedInByName}` : ''}
                      </p>
                    )}
                    {pass.checkedOutAt && (
                      <p>
                        Checked out {new Intl.DateTimeFormat(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(pass.checkedOutAt))}
                        {pass.checkedOutByName ? ` by ${pass.checkedOutByName}` : ''}
                      </p>
                    )}
                  </div>
                  {canManageVisitors && nextStatus && (
                    <button
                      className="visitor-pass-action"
                      type="button"
                      disabled={statusBusy}
                      onClick={() => onUpdateStatus(pass.id, nextStatus)}
                    >
                      {statusBusy
                        ? 'Updating…'
                        : nextStatus === 'CHECKED_IN'
                          ? 'Check in'
                          : 'Check out'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

function AmenitiesScreen({
  amenities,
  bookings,
  loading,
  error,
  canManage,
  busy,
  onCreateAmenity,
  onSetAvailability,
  onBook,
  onCancelBooking,
}: {
  amenities: CommunityAmenity[]
  bookings: AmenityBooking[]
  loading: boolean
  error: string
  canManage: boolean
  busy: boolean
  onCreateAmenity: (event: FormEvent<HTMLFormElement>) => void
  onSetAvailability: (amenityId: string, isActive: boolean) => void
  onBook: (amenityId: string) => void
  onCancelBooking: (bookingId: string) => void
}) {
  const dateTime = (value: string) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

  return (
    <section className="amenities-page">
      <header className="my-requests-heading">
        <div>
          <p className="eyebrow">YOUR COMMUNITY · SHARED SPACES</p>
          <h1>Amenities</h1>
          <p>Find a time for the spaces you love, with availability kept up to date.</p>
        </div>
      </header>

      {error && <p className="auth-error request-list-error" role="alert">{error}</p>}

      {canManage && (
        <section className="panel amenity-create-panel">
          <div>
            <p className="section-kicker">ADMINISTRATION</p>
            <h2>Add a shared space</h2>
            <p>Set up the amenities residents can book in your community.</p>
          </div>
          <form className="amenity-create-form" onSubmit={onCreateAmenity}>
            <label>
              Amenity name
              <input name="name" required maxLength={120} placeholder="e.g. Gym" />
            </label>
            <label>
              Location
              <input name="location" maxLength={120} placeholder="e.g. Clubhouse, ground floor" />
            </label>
            <label className="amenity-description-field">
              Description
              <input name="description" maxLength={500} placeholder="A short note about this space" />
            </label>
            <button className="button button-primary" type="submit" disabled={busy}>
              <Icon name="plus" size={15} /> {busy ? 'Saving…' : 'Add amenity'}
            </button>
          </form>
        </section>
      )}

      <section className="amenity-section">
        <div className="amenity-section-heading">
          <div>
            <p className="section-kicker">{canManage ? 'COMMUNITY CATALOG' : 'FIND YOUR SPACE'}</p>
            <h2>{canManage ? 'Manage amenities' : 'Book a shared space'}</h2>
          </div>
          <span className="heading-count">{amenities.length.toString().padStart(2, '0')}</span>
        </div>
        {loading ? (
          <p className="amenity-empty" role="status">Loading community amenities…</p>
        ) : amenities.length === 0 ? (
          <p className="amenity-empty">
            {canManage
              ? 'No amenities yet. Add a shared space above to open bookings.'
              : 'Your community has not added any bookable amenities yet.'}
          </p>
        ) : (
          <div className="amenity-grid">
            {amenities.map((amenity) => (
              <article className={`amenity-card${amenity.isActive ? '' : ' amenity-card-inactive'}`} key={amenity.id}>
                <span className="amenity-card-icon"><Icon name="calendar" size={21} /></span>
                <div className="amenity-card-heading">
                  <h3>{amenity.name}</h3>
                  {!amenity.isActive && <span className="amenity-inactive-label">Unavailable</span>}
                </div>
                <p className="amenity-card-location">{amenity.location || 'Community space'}</p>
                <p className="amenity-card-description">{amenity.description || 'Reserve a time that works for you.'}</p>
                <div className="amenity-card-actions">
                  {amenity.isActive && (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => onBook(amenity.id)}
                    >
                      Book a time <Icon name="arrow" size={14} />
                    </button>
                  )}
                  {canManage && (
                    <button
                      className="amenity-toggle"
                      type="button"
                      disabled={busy}
                      onClick={() => onSetAvailability(amenity.id, !amenity.isActive)}
                    >
                      {amenity.isActive ? 'Pause bookings' : 'Make available'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel amenity-bookings-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">{canManage ? 'COMMUNITY SCHEDULE' : 'YOUR COMMUNITY'}</p>
            <h2>Upcoming reservations</h2>
          </div>
          <span className="heading-count">{bookings.length.toString().padStart(2, '0')}</span>
        </div>
        {loading ? (
          <p className="empty-search" role="status">Loading reservations…</p>
        ) : bookings.length === 0 ? (
          <p className="empty-search">No upcoming reservations. Book an available amenity to get started.</p>
        ) : (
          <div className="amenity-booking-list">
            {bookings.map((booking) => (
              <article
                className={`amenity-booking-row${booking.status === 'CANCELLED' ? ' amenity-booking-cancelled' : ''}`}
                key={booking.id}
              >
                <span className="amenity-booking-icon"><Icon name="clock" size={18} /></span>
                <div className="amenity-booking-details">
                  <strong>{booking.amenityName}</strong>
                  <span>{dateTime(booking.startsAt)} – {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(booking.endsAt))}</span>
                  <small>
                    {booking.status === 'CANCELLED'
                      ? 'Cancelled'
                      : booking.bookedByName
                        ? `Booked by ${booking.bookedByName}`
                        : booking.isMine
                          ? 'Your reservation'
                          : 'Reserved'}
                  </small>
                </div>
                {booking.status === 'CONFIRMED' && (
                  <span className="amenity-booking-status">Confirmed</span>
                )}
                {booking.canCancel && booking.status === 'CONFIRMED' && (
                  <button
                    className="amenity-cancel-action"
                    type="button"
                    disabled={busy}
                    onClick={() => onCancelBooking(booking.id)}
                  >
                    Cancel
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function SecurityTeamScreen({
  members,
  loading,
  error,
  busy,
  onRoleChange,
}: {
  members: CommunityMemberRole[]
  loading: boolean
  error: string
  busy: boolean
  onRoleChange: (membershipId: string, enabled: boolean) => void
}) {
  return (
    <section className="visitor-page security-team-page">
      <header className="my-requests-heading">
        <div>
          <p className="eyebrow">COMMUNITY ADMINISTRATION · ACCESS</p>
          <h1>Security team</h1>
          <p>Choose which active members can manage visitor entry at the gate.</p>
        </div>
      </header>
      <section className="panel visitor-panel">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">COMMUNITY MEMBERS</p>
            <h2>Security access</h2>
          </div>
          <span className="heading-count">{members.length.toString().padStart(2, '0')}</span>
        </div>
        {error && <p className="auth-error request-list-error" role="alert">{error}</p>}
        {loading ? (
          <p className="empty-search" role="status">Loading community members…</p>
        ) : members.length === 0 ? (
          <p className="empty-search">No active members found in this community.</p>
        ) : (
          <div className="visitor-list">
            {members.map((member) => {
              const isAdministrator = member.roles.includes('ADMINISTRATOR')
              const isSecurityGuard = member.roles.includes('SECURITY_GUARD')
              return (
                <article className="visitor-pass-card security-member-card" key={member.membershipId}>
                  <span className="visitor-pass-icon"><Icon name="door" size={19} /></span>
                  <div className="visitor-pass-main">
                    <div className="visitor-pass-heading">
                      <h3>{member.fullName}</h3>
                      {isAdministrator && (
                        <span className="visitor-pass-status visitor-pass-checked-in">Administrator</span>
                      )}
                    </div>
                    <p>{member.email}</p>
                    <p>
                      Current roles: {member.roles
                        .filter((role) => role !== 'SECURITY_GUARD')
                        .map((role) => role.replaceAll('_', ' ').toLowerCase())
                        .join(', ') || 'None'}
                    </p>
                  </div>
                  {isAdministrator ? (
                    <span className="security-access-note">Admin access included</span>
                  ) : (
                    <button
                      className={`visitor-pass-action ${isSecurityGuard ? 'security-remove-action' : ''}`}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onRoleChange(member.membershipId, !isSecurityGuard)
                      }
                    >
                      {busy
                        ? 'Updating…'
                        : isSecurityGuard
                          ? 'Remove security access'
                          : 'Grant security access'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

function Dashboard({
  requests,
  requestsLoading,
  requestsError,
  requestStatusError,
  canManageRequests,
  requestStatusBusy,
  onStatusUpdate,
  showAllRequests,
  setShowAllRequests,
  showAllAnnouncements,
  setShowAllAnnouncements,
  searchQuery,
  firstName,
  communityName,
  visitorsToday,
  checkedInVisitorsToday,
  expectedVisitorsToday,
  visitorsLoading,
  visitorsError,
  amenityBookings,
  amenitiesLoading,
  amenitiesError,
  goTo,
  openAction,
}: {
  requests: CommunityServiceRequest[]
  requestsLoading: boolean
  requestsError: string
  requestStatusError: string
  canManageRequests: boolean
  requestStatusBusy: boolean
  onStatusUpdate: (
    requestId: string,
    status: ServiceRequestStatus,
    note?: string,
  ) => void
  showAllRequests: boolean
  setShowAllRequests: (value: boolean) => void
  showAllAnnouncements: boolean
  setShowAllAnnouncements: (value: boolean) => void
  searchQuery: string
  firstName: string
  communityName: string
  visitorsToday: number
  checkedInVisitorsToday: number
  expectedVisitorsToday: number
  visitorsLoading: boolean
  visitorsError: string
  amenityBookings: AmenityBooking[]
  amenitiesLoading: boolean
  amenitiesError: string
  goTo: (page: string) => void
  openAction: (type: 'request' | 'visitor' | 'booking') => void
}) {
  const [requestFilter, setRequestFilter] = useState('All')
  const query = searchQuery.trim().toLowerCase()
  const matchingRequests = requests.filter((request) => {
    const status = requestStatusLabel(request.status)
    const matchesStatus = requestFilter === 'All' || status.toLowerCase() === requestFilter.toLowerCase()
    const matchesQuery = !query || `${request.title} ${request.location} ${request.category} ${status}`.toLowerCase().includes(query)
    return matchesStatus && matchesQuery
  })
  const visibleRequests = showAllRequests || query || requestFilter !== 'All' ? matchingRequests : matchingRequests.slice(0, 3)
  const matchingAnnouncements = announcements.filter((announcement) =>
    !query || `${announcement.tag} ${announcement.title} ${announcement.body}`.toLowerCase().includes(query),
  )
  const visibleAnnouncements = showAllAnnouncements || query ? matchingAnnouncements : matchingAnnouncements.slice(0, 2)
  const openRequestCount = requests.filter((request) => request.status === 'OPEN').length
  const inProgressRequestCount = requests.filter((request) => request.status === 'IN_PROGRESS').length
  const unresolvedRequestCount = openRequestCount + inProgressRequestCount
  const nextAmenityBooking = amenityBookings[0]

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()} <span className="eyebrow-dot">·</span> {communityName.toUpperCase()}</p>
          <h1>Hey {firstName}, you’re home <span className="wave">✳</span></h1>
          <p className="heading-subtitle">Your people, your place, your day — all looking good.</p>
        </div>
        <button className="button button-primary" onClick={() => openAction('request')}><Icon name="plus" size={17} /> New request</button>
      </div>

      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker"><span className="live-dot" /> THE GOOD STUFF, ALL TOGETHER</span>
          <h2>Your community.<br />Your kind of <em>everyday.</em></h2>
          <p>Little updates, helpful people and more time to feel at home.</p>
          <button type="button" onClick={() => goTo('Announcements')}>See what’s new <Icon name="arrow" size={15} /></button>
        </div>
        <img className="welcome-illustration" src={communityIllustration} alt="" aria-hidden="true" />
        <span className="banner-sparkle sparkle-one"><Icon name="sparkle" size={22} /></span><span className="banner-sparkle sparkle-two"><Icon name="sparkle" size={16} /></span>
      </section>

      <section className="stats-grid" aria-label="Your community at a glance">
        <StatCard label="Unresolved requests" value={unresolvedRequestCount.toString().padStart(2, '0')} note={`${openRequestCount} open · ${inProgressRequestCount} in progress`} icon="inbox" tone="green" onClick={() => goTo('My requests')} />
        <StatCard label="Maintenance due" value={`₹${pendingMaintenance.toLocaleString('en-IN')}`} note="Due 25 October" icon="wallet" tone="gold" onClick={() => goTo('My payments')} />
        <StatCard
          label="Upcoming bookings"
          value={
            amenitiesError
              ? '—'
              : amenitiesLoading
                ? '…'
                : amenityBookings.length.toString().padStart(2, '0')
          }
          note={
            amenitiesError
              ? 'Unable to load amenity schedule'
              : amenitiesLoading
                ? 'Loading reservations'
                : nextAmenityBooking
                  ? `${nextAmenityBooking.amenityName} · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(nextAmenityBooking.startsAt))}`
                  : 'No upcoming reservations'
          }
          icon="calendar"
          tone="blue"
          onClick={() => goTo('Amenities')}
        />
        <StatCard
          label="Visitors today"
          value={
            visitorsError
              ? '—'
              : visitorsLoading
                ? '…'
                : visitorsToday.toString().padStart(2, '0')
          }
          note={
            visitorsError
              ? 'Unable to load visitor log'
              : visitorsLoading
                ? 'Loading visitor data'
                : `${checkedInVisitorsToday} checked in · ${expectedVisitorsToday} expected`
          }
          icon="door"
          tone="rose"
          onClick={() => goTo('Visitor log')}
        />
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <span className="quick-actions-label">QUICK ACTIONS</span>
        <button type="button" onClick={() => openAction('request')}><span className="quick-icon quick-coral"><Icon name="plus" size={16} /></span>Report an issue<Icon className="quick-arrow" name="arrow" size={13} /></button>
        <button type="button" onClick={() => openAction('visitor')}><span className="quick-icon quick-blue"><Icon name="car" size={16} /></span>Invite a visitor<Icon className="quick-arrow" name="arrow" size={13} /></button>
        <button type="button" onClick={() => openAction('booking')}><span className="quick-icon quick-yellow"><Icon name="calendar" size={16} /></span>Book an amenity<Icon className="quick-arrow" name="arrow" size={13} /></button>
      </section>

      <div className="content-grid">
        <section className="panel requests-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">YOUR NEIGHBORHOOD</p><h2>Requests, in the works <span className="heading-count">{requests.length.toString().padStart(2, '0')}</span></h2></div>
            <button className="text-link" type="button" onClick={() => setShowAllRequests(!showAllRequests)}>{showAllRequests ? 'Show recent' : 'View all'} <Icon name="arrow" size={14} /></button>
          </div>
          <div className="request-filter-row" aria-label="Filter requests">
            {['All', 'Open', 'In progress', 'Resolved'].map((filter) => (
              <button key={filter} type="button" className={`filter-chip ${requestFilter === filter ? 'filter-chip-active' : ''}`} onClick={() => setRequestFilter(filter)}>{filter}</button>
            ))}
          </div>
          <ServiceRequestRows
            requests={visibleRequests}
            loading={requestsLoading}
            error={requestsError}
            emptyMessage={searchQuery || requestFilter !== 'All'
              ? `No requests match “${searchQuery || requestFilter}”. Try another search or filter.`
              : 'No requests reported yet. Add one and it will appear here.'}
            canManageRequests={canManageRequests}
            statusBusy={requestStatusBusy}
            onStatusUpdate={onStatusUpdate}
          />
          {requestStatusError && <p className="auth-error request-list-error" role="alert">{requestStatusError}</p>}
          <button className="panel-bottom-link" type="button" onClick={() => goTo('My requests')}>Go to my requests <Icon name="arrow" size={14} /></button>
        </section>

        <section className="panel announcements-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">A NOTE FROM YOUR COMMUNITY</p><h2>Good things bulletin <span className="heading-count">{announcements.length.toString().padStart(2, '0')}</span></h2></div>
            <button className="text-link" type="button" onClick={() => setShowAllAnnouncements(!showAllAnnouncements)}>{showAllAnnouncements ? 'Show recent' : 'View all'} <Icon name="arrow" size={14} /></button>
          </div>
          <div className="announcement-list">
            {visibleAnnouncements.map((announcement) => (
              <article className="announcement-card" key={announcement.title}>
                <div className={`announcement-accent accent-${announcement.color}`} />
                <div className="announcement-content">
                  <div className="announcement-meta"><span className={`announcement-tag tag-${announcement.color}`}>{announcement.tag}</span><span>{announcement.date}</span></div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.body}</p>
                </div>
              </article>
            ))}
            {visibleAnnouncements.length === 0 && <p className="empty-search">No community updates match “{searchQuery}”.</p>}
          </div>
          <button className="panel-bottom-link" type="button" onClick={() => goTo('Announcements')}>All announcements <Icon name="arrow" size={14} /></button>
        </section>
      </div>

      <section className="bottom-grid">
        <article className="next-up-card">
          <div className="next-up-copy">
            <p className="section-kicker">A LITTLE TIME FOR YOU</p>
            <h2>Your next up</h2>
            <div className="booking-line">
              <span className="booking-icon"><Icon name="calendar" size={17} /></span>
              <div>
                <strong>{nextAmenityBooking ? `${nextAmenityBooking.amenityName} reservation` : amenitiesLoading ? 'Loading reservations…' : 'No reservation yet'}</strong>
                <span>
                  {nextAmenityBooking
                    ? new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(nextAmenityBooking.startsAt))
                    : amenitiesError
                      ? 'Unable to load your community schedule'
                      : 'Book a shared space for your next activity'}
                </span>
                <small>
                  {amenityBookings.length > 1
                    ? `Next: ${amenityBookings[1].amenityName} · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(amenityBookings[1].startsAt))}`
                    : 'Your upcoming reservations appear here'}
                </small>
              </div>
              <button aria-label="Booking details" onClick={() => goTo('Amenities')}><Icon name="arrow" size={16} /></button>
            </div>
            <button className="text-link next-up-link" onClick={() => goTo('Amenities')}>Explore amenities <Icon name="arrow" size={14} /></button>
          </div>
          <div className="next-up-art" aria-hidden="true"><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-sun" /><span className="art-leaf leaf-one" /><span className="art-leaf leaf-two" /><span className="art-leaf leaf-three" /></div>
        </article>

        <article className="payment-card">
          <div className="payment-card-top"><span className="payment-icon"><Icon name="wallet" size={17} /></span><span className="payment-label">MAINTENANCE · OCTOBER</span><span className="payment-due-badge">DUE SOON</span></div>
          <p className="section-kicker">OCTOBER 2026</p>
          <h2>₹{pendingMaintenance.toLocaleString('en-IN')} <span>due 25 Oct</span></h2>
          <p className="payment-copy">Monthly maintenance for Apartment A-204. Pay by the due date to keep your account up to date.</p>
          <button className="text-link" onClick={() => goTo('My payments')}>View payment details <Icon name="arrow" size={14} /></button>
          <div className="payment-plant" aria-hidden="true"><i /><i /><i /><b /></div>
        </article>
      </section>

      <div className="demo-notice"><span><Icon name="clock" size={14} /></span> Preview feature data · Not live community records · {communityName}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
  note,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  note: string
  icon: IconName
  tone: string
  onClick: () => void
}) {
  return (
    <button className="stat-card" type="button" onClick={onClick}>
      <span className={`stat-icon stat-${tone}`}><Icon name={icon} size={19} /></span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </button>
  )
}

function ActionModal({
  type,
  onClose,
  busy,
  error,
  visitorUnits,
  visitorUnitsLoading,
  amenities,
  selectedAmenityId,
  onSubmit,
}: {
  type: 'request' | 'visitor' | 'booking'
  onClose: () => void
  busy: boolean
  error: string
  visitorUnits: VisitorUnit[]
  visitorUnitsLoading: boolean
  amenities: CommunityAmenity[]
  selectedAmenityId: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const today = new Date()
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const localDateTime = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  const content = {
    request: {
      eyebrow: 'HELP US MAKE IT BETTER',
      title: 'Report an issue',
      description: 'Tell your community team what needs attention.',
      submit: 'Submit request',
      fields: (
        <>
          <label>What needs attention?<input name="title" required maxLength={120} placeholder="e.g. Water leak in kitchen" /></label>
          <label>Request type
            <select name="category" defaultValue="GENERAL">
              <option value="GENERAL">General maintenance</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="CLEANING">Cleaning</option>
              <option value="SECURITY">Security</option>
            </select>
          </label>
          <label>Where is it?<input name="location" required maxLength={160} placeholder="e.g. Block A, apartment 204" /></label>
          <label>Tell us a little more<textarea name="details" rows={3} maxLength={1000} placeholder="Add details to help the team..." /></label>
        </>
      ),
    },
    visitor: {
      eyebrow: 'A FRIEND IS ON THE WAY',
      title: 'Invite a visitor',
      description: 'Register an expected guest for your apartment.',
      submit: 'Create visitor pass',
      fields: (
        <>
          <label>Visitor’s name<input name="visitorName" required maxLength={120} placeholder="Full name" /></label>
          <label>Apartment
            <select name="unitId" required disabled={visitorUnitsLoading || visitorUnits.length === 0} defaultValue={visitorUnits.length === 1 ? visitorUnits[0].id : ''}>
              <option value="" disabled>{visitorUnitsLoading ? 'Loading apartments…' : 'Choose your apartment'}</option>
              {visitorUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.block.name} · Apartment {unit.number}
                </option>
              ))}
            </select>
          </label>
          {visitorUnits.length === 0 && !visitorUnitsLoading && (
            <p className="visitor-unit-help">Your account needs an apartment linked by a community administrator before you can create visitor passes.</p>
          )}
          <label>Visit date<input name="visitDate" required type="date" min={todayValue} /></label>
          <label>Expected arrival<input name="arrivalTime" required type="time" /></label>
          <label>Purpose<select name="purpose" defaultValue="PERSONAL_VISIT"><option value="PERSONAL_VISIT">Personal visit</option><option value="DELIVERY">Delivery</option><option value="SERVICE">Service / maintenance</option></select></label>
        </>
      ),
    },
    booking: {
      eyebrow: 'MAKE SOME TIME FOR YOU',
      title: 'Book an amenity',
      description: 'Choose an available space and reserve a future time of up to four hours.',
      submit: 'Save booking',
      fields: (
        <>
          <label>Choose an amenity
            <select
              name="amenityId"
              required
              defaultValue={selectedAmenityId || (amenities.length === 1 ? amenities[0].id : '')}
              disabled={amenities.length === 0}
            >
              <option value="" disabled>
                {amenities.length ? 'Select a shared space' : 'No amenities available yet'}
              </option>
              {amenities.map((amenity) => (
                <option key={amenity.id} value={amenity.id}>
                  {amenity.name}{amenity.location ? ` · ${amenity.location}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>Starts at<input name="startsAt" required type="datetime-local" min={localDateTime} /></label>
          <label>Ends at<input name="endsAt" required type="datetime-local" min={localDateTime} /></label>
        </>
      ),
    },
  }[type]

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="action-modal-title">
        <div className={`modal-art modal-art-${type}`} aria-hidden="true"><span /><span /><span /><Icon name={type === 'visitor' ? 'car' : type === 'booking' ? 'calendar' : 'sparkle'} size={27} /></div>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={19} /></button>
        <div className="modal-content">
          <p className="section-kicker">{content.eyebrow}</p>
          <h2 id="action-modal-title">{content.title}</h2>
          <p className="modal-description">{content.description}</p>
          <form onSubmit={onSubmit}>
            {content.fields}
            {error && <p className="auth-error request-submit-error" role="alert">{error}</p>}
            <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || (type === 'visitor' && (visitorUnitsLoading || visitorUnits.length === 0)) || (type === 'booking' && amenities.length === 0)}>{busy ? 'Submitting…' : content.submit}<Icon name="arrow" size={14} /></button></div>
          </form>
          <p className="modal-preview-note"><Icon name="sparkle" size={13} /> {type === 'request' ? 'Your request will be saved to this community and appear in your request list.' : type === 'visitor' ? 'Security can see this pass and record the guest’s arrival and departure.' : 'Availability is checked before your reservation is confirmed.'}</p>
        </div>
      </section>
    </div>
  )
}

createRoot(document.getElementById('app')!).render(<App />)
