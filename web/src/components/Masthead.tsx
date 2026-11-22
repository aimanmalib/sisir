import { languages } from '@sisir/rules';
import { useI18n } from '../i18n/i18n.js';
import { CombMark } from './icons.js';

/** Name, what it does in one sentence, and the language switch. */
export function Masthead() {
  const { lang, setLang, t } = useI18n();
  return (
    <header className="masthead">
      <div className="masthead__brand">
        <CombMark />
        <span className="masthead__name">Sisir</span>
      </div>
      <p className="masthead__tagline">{t('header.tagline')}</p>
      <div className="langs" role="group" aria-label={t('header.language')}>
        {languages.map((code) => (
          <button
            key={code}
            type="button"
            className="langs__opt"
            lang={code}
            aria-pressed={lang === code}
            aria-label={t(`lang.${code}Name`)}
            onClick={() => setLang(code)}
          >
            {t(`lang.${code}`)}
          </button>
        ))}
      </div>
    </header>
  );
}
