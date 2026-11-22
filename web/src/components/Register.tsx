import { catalog, type FileResult } from '@sisir/rules';
import { useI18n } from '../i18n/i18n.js';

interface RegisterProps {
  result: FileResult;
  empty: boolean;
  ruleFilter: string | null;
  onFilter(id: string | null): void;
}

/** The verdict for the whole file, stamped when there are no errors. */
function Verdict({ result, empty }: Pick<RegisterProps, 'result' | 'empty'>) {
  const { t } = useI18n();
  const errors = result.findings.filter((f) => f.level === 'error').length;
  const warnings = result.findings.filter((f) => f.level === 'warning').length;
  const count = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, { count: n }));
  let state: 'empty' | 'parse' | 'fail' | 'clear';
  if (empty) state = 'empty';
  else if (result.error) state = 'parse';
  else state = errors > 0 ? 'fail' : 'clear';
  return (
    <div className="verdict" data-state={state} role="status" aria-live="polite">
      {state === 'empty' ? <p className="verdict__line">{t('verdict.empty')}</p> : null}
      {state === 'parse' ? <p className="verdict__line">{t('verdict.parse')}</p> : null}
      {state === 'fail' || state === 'clear' ? (
        <>
          <p className="verdict__big">{errors === 0 ? t('verdict.clear') : count(errors, 'verdict.error', 'verdict.errors')}</p>
          {warnings > 0 ? <p className="verdict__line">{count(warnings, 'verdict.warning', 'verdict.warnings')}</p> : null}
        </>
      ) : null}
      {state === 'clear' ? (
        <span className="stamp" aria-hidden="true">
          {t('verdict.stamp')}
        </span>
      ) : null}
    </div>
  );
}

/** The inspection register: the verdict, then one row per rule with its count. A row filters the sheet. */
export function Register({ result, empty, ruleFilter, onFilter }: RegisterProps) {
  const { t } = useI18n();
  const counts = new Map<string, number>();
  for (const f of result.findings) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
  return (
    <aside className="register" aria-labelledby="register-title">
      <h2 id="register-title" className="register__title">
        {t('register.title')}
      </h2>
      <Verdict result={result} empty={empty} />
      <h3 className="register__sub">{t('register.rules')}</h3>
      <ul className="rules">
        {[...catalog.values()].map((rule) => {
          const n = counts.get(rule.id) ?? 0;
          const active = ruleFilter === rule.id;
          return (
            <li key={rule.id}>
              <button
                type="button"
                className="rule"
                data-hit={n > 0 || undefined}
                data-level={rule.level}
                aria-pressed={active}
                disabled={n === 0}
                title={n === 0 ? t('register.none') : t(active ? 'register.showAll' : 'register.showRule', { id: rule.id })}
                onClick={() => onFilter(active ? null : rule.id)}
              >
                <span className="rule__id">{rule.id}</span>
                <span className="rule__name">{rule.name}</span>
                <span className="rule__count">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
