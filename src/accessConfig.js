/* eslint-disable no-undef */
import { restaurants } from './restaurants.js'

const key = typeof __RESTAURANT__ !== 'undefined' ? __RESTAURANT__ : 'spice'
export const OWNER_UIDS = (restaurants[key] ?? restaurants.spice).ownerUids
