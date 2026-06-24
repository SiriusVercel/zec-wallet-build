import 'i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'

import en from './translations/en'
import ptBR from './translations/pt-BR'
import es from './translations/es'
import fr from './translations/fr'
import de from './translations/de'
import it from './translations/it'
import zhCN from './translations/zh-CN'
import ja from './translations/ja'
import ko from './translations/ko'
import ru from './translations/ru'
import ar from './translations/ar'
import hi from './translations/hi'
import tr from './translations/tr'
import nl from './translations/nl'
import pl from './translations/pl'
import sv from './translations/sv'
import uk from './translations/uk'
import id from './translations/id'
import vi from './translations/vi'
import th from './translations/th'

const resources = {
  en:      { translation: en },
  'pt-BR': { translation: ptBR },
  es:      { translation: es },
  fr:      { translation: fr },
  de:      { translation: de },
  it:      { translation: it },
  'zh-CN': { translation: zhCN },
  ja:      { translation: ja },
  ko:      { translation: ko },
  ru:      { translation: ru },
  ar:      { translation: ar },
  hi:      { translation: hi },
  tr:      { translation: tr },
  nl:      { translation: nl },
  pl:      { translation: pl },
  sv:      { translation: sv },
  uk:      { translation: uk },
  id:      { translation: id },
  vi:      { translation: vi },
  th:      { translation: th },
}

const deviceLocale = Localization.getLocales()?.[0]?.languageTag ?? 'en'
const supportedLocales = Object.keys(resources)

function matchLocale(locale: string): string {
  if (supportedLocales.includes(locale)) return locale
  const lang = locale.split('-')[0]
  const match = supportedLocales.find(l => l === lang || l.startsWith(lang + '-'))
  return match ?? 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: matchLocale(deviceLocale),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
  })

export default i18n
export { resources, matchLocale }
