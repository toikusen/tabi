// Twemoji 15.0.0 (@twemoji/svg), graphics CC-BY 4.0 — https://github.com/jdecked/twemoji
// Bundled rather than native emoji so every OS draws the same glyph; each file
// is under Vite's 4KB inline limit, so they ship inside the JS and work offline.
// Picked for colour at 18px: 🍴 and 🚆 are grey-on-grey and blur into the tile.
import food from '../assets/twemoji/1f35c.svg'
import lodging from '../assets/twemoji/1f3e8.svg'
import transport from '../assets/twemoji/1f697.svg'
import sight from '../assets/twemoji/1f4f7.svg'
import shopping from '../assets/twemoji/1f6cd.svg'
import pin from '../assets/twemoji/1f4cd.svg'

export type Category = 'food' | 'lodging' | 'transport' | 'sight' | 'shopping' | 'pin'

/** 🍜 🏨 🚗 📷 🛍️ 📍 */
export const CATEGORY_IMAGE: Record<Category, string> = {
  food,
  lodging,
  transport,
  sight,
  shopping,
  pin,
}

/**
 * First match wins, so order encodes precedence: a "飯店早餐" is a hotel stop
 * before it is a meal. Latin keywords are word-bounded — without `\binn\b`,
 * "dinner" books a hotel room.
 */
const RULES: [RegExp, Category][] = [
  [/飯店|旅館|民宿|住宿|旅店|ホテル|入住|退房|check.?in|check.?out|\bhotel\b|\binn\b|\bhostel\b/i, 'lodging'],
  [/機場|空港|航班|班機|飛機|車站|駅|電車|新幹線|單軌|地鐵|巴士|公車|客運|租車|渡輪|計程車|\bairport\b|\bflight\b|\btrain\b|\bbus\b|\btransfer\b/i, 'transport'],
  [/早餐|午餐|晚餐|宵夜|餐廳|美食|拉麵|壽司|燒肉|燒鳥|定食|食堂|居酒屋|丼|市場|咖啡|カフェ|甜點|冰淇淋|\bcafe\b|\blunch\b|\bdinner\b|\bbreakfast\b|\bbar\b/i, 'food'],
  [/購物|商店街|藥妝|百貨|免稅|超市|市集|唐吉|驚安|\boutlet\b|\bmall\b|\bshopping\b/i, 'shopping'],
  [/神社|寺|城|公園|展望|水族館|博物館|美術館|海灘|沙灘|海岸|溫泉|温泉|樂園|動物園|瀑布|燈塔|迪士尼|環球|\bpark\b|\bmuseum\b|\bbeach\b|\btower\b|\bcastle\b|\bshrine\b|\btemple\b|\bUSJ\b/i, 'sight'],
]

/**
 * Guess the leading icon for an event from its title.
 *
 * ponytail: title only — a location is usually an address, which matches the
 * wrong keyword more often than it helps. An unmatched title gets `pin`, which
 * is why the neutral glyph has to look deliberate: it is the common case.
 */
export function eventCategory(title: string): Category {
  return RULES.find(([re]) => re.test(title))?.[1] ?? 'pin'
}
