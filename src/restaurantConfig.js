/* eslint-disable no-undef */
import { restaurants } from './restaurants.js'

const key = typeof __RESTAURANT__ !== 'undefined' ? __RESTAURANT__ : 'spice'
export const restaurant = restaurants[key] ?? restaurants.spice

export const {
  name: restaurantName,
  subtitle: restaurantSubtitle,
  logo: restaurantLogo,
  firebase: firebaseConfig,
  ownerUids: OWNER_UIDS,
} = restaurant
