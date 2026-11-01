import spiceLogo from './assets/logo.png'
import karavalliLogo from './assets/Karavalli.png'

/**
 * Master config for every restaurant.
 * To add a new restaurant:
 *   1. Add its logo to src/assets/
 *   2. Add an entry here
 *   3. Create .env.<key> with VITE_OWNER_EMAILS, VITE_PAGE_PIN, VITE_REPORT_PIN
 *   4. Add a Cloudflare Pages project with build command: npm run build:<key>
 *   5. Add "build:<key>" script to package.json
 */
export const restaurants = {
  spice: {
    name: 'Spice Malabar',
    subtitle: 'Daily Sales Report',
    logo: spiceLogo,
    firebase: {
      apiKey: 'AIzaSyCTA4j83zlxBSU3lrXiL43LxQpM7QB1ZKA',
      authDomain: 'invoice-bded6.firebaseapp.com',
      projectId: 'invoice-bded6',
      storageBucket: 'invoice-bded6.firebasestorage.app',
      messagingSenderId: '1072275972159',
      appId: '1:1072275972159:web:773cb82812c1bf3308188a',
    },
    ownerUids: ['XCzpfJgupafGt3kYdvxWnzTHcxu2'],
  },
  karavalli: {
    name: 'Karavalli',
    subtitle: 'Daily Report',
    logo: karavalliLogo,
    firebase: {
      apiKey: 'AIzaSyDzLLdmpWb3ygeITIl_3qNAsyDQ8WoGsEo',
      authDomain: 'karavalli-7eae2.firebaseapp.com',
      projectId: 'karavalli-7eae2',
      storageBucket: 'karavalli-7eae2.firebasestorage.app',
      messagingSenderId: '466622468225',
      appId: '1:466622468225:web:d1efb54c424b8de8e87d80',
    },
    ownerUids: ['pRvZaGOEAMhufvxeUGvJeb3O0xF3'],
  },
}
