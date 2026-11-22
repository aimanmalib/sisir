import { useCallback, useMemo, useState } from 'react';
import { Masthead } from './components/Masthead.js';
import { Register } from './components/Register.js';
import { SourceSheet, type SheetMode } from './components/SourceSheet.js';
import { Toolbar } from './components/Toolbar.js';
import { LockIcon } from './components/icons.js';
import { config } from './config.js';
import { useI18n } from './i18n/i18n.js';
import { findingKey, inspect } from './lint/inspect.js';
import { readText } from './lint/readFile.js';
import { useDebounced } from './lint/useDebounced.js';
import { samples } from './samples.js';

const FIRST = samples[0];
const UNTITLED = 'Contract.sol';

/** The playground: a source on the bench, a tag on every flagged line, and the register beside it. */
export function App() {
  const { t } = useI18n();
  const [source, setSource] = useState(FIRST?.source ?? '');
  const [fileName, setFileName] = useState(FIRST?.fileName ?? UNTITLED);
  const [sampleId, setSampleId] = useState<string | null>(FIRST?.id ?? null);
  const [mode, setMode] = useState<SheetMode>('inspect');
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Typing is debounced; loading an example or a file is checked at once.
  const settled = useDebounced(source, mode === 'edit' ? config.playground.lintDelayMs : 0);
  const result = useMemo(() => inspect(settled, fileName), [settled, fileName]);
  const firstKey = result.findings[0] ? findingKey(result.findings[0]) : null;
  const shownKey = openKey ?? firstKey;

  const load = useCallback((next: string, name: string, id: string | null) => {
    setSource(next);
    setFileName(name);
    setSampleId(id);
    setRuleFilter(null);
    setOpenKey(null);
    setNotice(null);
  }, []);

  const onSample = (id: string) => {
    const s = samples.find((x) => x.id === id);
    if (s) load(s.source, s.fileName, s.id);
  };

  const onFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.sol')) return setNotice(t('error.notSol'));
    const max = config.playground.maxSourceBytes;
    if (file.size > max) return setNotice(t('error.tooLarge', { kb: Math.floor(max / 1024) }));
    try {
      load(await readText(file), file.name, null);
      setMode('inspect');
    } catch {
      setNotice(t('error.read'));
    }
  };

  const onEdit = (next: string) => {
    setSource(next);
    if (sampleId !== null) {
      setSampleId(null);
      setFileName(UNTITLED);
    }
  };

  return (
    <>
      <a className="skip" href="#source">
        {t('skip')}
      </a>
      <Masthead />
      <main className="bench">
        <div className="work">
          <Toolbar
            sampleId={sampleId}
            fileName={fileName}
            mode={mode}
            onSample={onSample}
            onFile={onFile}
            onMode={setMode}
            onClear={() => {
              load('', UNTITLED, null);
              setMode('edit');
            }}
          />
          {notice ? (
            <p className="notice" role="alert">
              {notice}
            </p>
          ) : null}
          <SourceSheet
            mode={mode}
            source={mode === 'edit' ? source : settled}
            fileName={fileName}
            result={result}
            ruleFilter={ruleFilter}
            openKey={shownKey}
            onToggleTag={(key) => setOpenKey(shownKey === key ? '' : key)}
            onSourceChange={onEdit}
            onDropFile={onFile}
          />
          <p className="private">
            <LockIcon /> {t('sheet.private')}
          </p>
        </div>
        <Register result={result} empty={settled.trim() === ''} ruleFilter={ruleFilter} onFilter={setRuleFilter} />
      </main>
      <footer className="colophon">
        <p>{t('footer.complement')}</p>
        <p>{t('footer.credit')}</p>
        <nav className="colophon__links">
          <a href={config.links.rules}>{t('footer.rules')}</a>
          <a href={config.links.repo}>{t('footer.source')}</a>
          <span>{t('footer.license')}</span>
        </nav>
      </footer>
    </>
  );
}
