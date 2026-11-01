/* eslint-disable no-undef */
import { restaurants } from './restaurants.js'
import spiceLogo from './assets/logo.png'
import karavalliLogo from './assets/Karavalli.png'

// Logo map — add a new entry here whenever you add a restaurant to restaurants.js
const logos = {
  spice: spiceLogo,
  karavalli: karavalliLogo,
}

const key = typeof __RESTAURANT__ !== 'undefined' ? __RESTAURANT__ : 'spice'
const data = restaurants[key] ?? restaurants.spice

export const restaurantName = data.name
export const restaurantSubtitle = data.subtitle
export const restaurantLogo = logos[key] ?? logos.spice
export const firebaseConfig = data.firebase
export const OWNER_UIDS = data.ownerUids
