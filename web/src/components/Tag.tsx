import type { Finding } from '@sisir/rules';
import { useI18n } from '../i18n/i18n.js';
import { findingKey, findingText } from '../lint/inspect.js';
import { ExternalIcon } from './icons.js';

interface TagProps {
  finding: Finding;
  open: boolean;
  onToggle(key: string): void;
}

/** One finding as an inspection tag tied to its line: id, level and problem; open for detail, fix and docs. */
export function Tag({ finding, open, onToggle }: TagProps) {
  const { lang, t } = useI18n();
  const key = findingKey(finding);
  const text = findingText(finding, lang);
  const bodyId = `tag-${key.replace(/:/g, '-')}`;
  return (
    <div className={`tag tag--${finding.level}`} data-open={open || undefined}>
      <button type="button" className="tag__head" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(key)}>
        <span className="tag__eyelet" aria-hidden="true" />
        <span className="tag__id">{finding.ruleId}</span>
        <span className="tag__level">{t(`level.${finding.level}`)}</span>
        <span className="tag__where">{t('tag.line', { line: finding.line })}</span>
        <span className="tag__message">{text.message}</span>
      </button>
      <div className="tag__body" id={bodyId} hidden={!open}>
        {text.detail ? <p className="tag__detail">{text.detail}</p> : null}
        <p className="tag__fix">
          <span className="tag__label">{t('tag.fix')}</span> {text.fix}
        </p>
        <a className="tag__docs" href={finding.docs} target="_blank" rel="noreferrer">
          {t('tag.docs')} <ExternalIcon />
        </a>
      </div>
    </div>
  );
}

interface ParseTagProps {
  line: number;
  column: number;
  message: string;
}

/** A file that does not parse gets one tag on the line the parser stopped at. */
export function ParseTag({ line, column, message }: ParseTagProps) {
  const { t } = useI18n();
  return (
    <div className="tag tag--parse" data-open>
      <div className="tag__head">
        <span className="tag__eyelet" aria-hidden="true" />
        <span className="tag__id">{t('parse.title')}</span>
        <span className="tag__where">{t('tag.line', { line })}</span>
      </div>
      <div className="tag__body">
        <p className="tag__detail">{t('parse.where', { line, column })}</p>
        <p className="tag__parser">
          <code>{message}</code>
        </p>
      </div>
    </div>
  );
}
