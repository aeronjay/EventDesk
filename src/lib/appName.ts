import { isDemoMode } from './supabaseClient'

// The portfolio demo ships under a different name than the internal app.
export const APP_NAME = isDemoMode ? 'EventDesk' : 'QSolicit'
export const APP_LONG_NAME = isDemoMode ? 'EventDesk' : 'QSolicitations'
export const APP_INITIAL = APP_NAME[0]

// What a record is called in the UI ("Solicitation" in the real app, "Event" in the demo).
export const TERMS = isDemoMode
  ? { One: 'Event', one: 'event', Many: 'Events', many: 'events', Short: 'Events' }
  : { One: 'Solicitation', one: 'solicitation', Many: 'Solicitations', many: 'solicitations', Short: 'Solicits' }
