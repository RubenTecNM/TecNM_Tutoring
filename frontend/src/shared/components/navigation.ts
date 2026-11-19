import type { RouteLocationRaw } from 'vue-router'

export interface NavigationLink {
  label: string
  to: RouteLocationRaw
  badge?: number
  badgeTitle?: string
}

export interface NavigationGroup {
  label: string
  children: NavigationLink[]
}

export type NavigationItem = NavigationLink | NavigationGroup

export interface BrandOptions {
  title?: string
  subtitle?: string
  showTitle?: boolean
  showLogo?: boolean
  logo?: string
}
