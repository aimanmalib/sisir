import { useMemo, useState, type DragEvent } from 'react';
import type { FileResult } from '@sisir/rules';
import { useI18n } from '../i18n/i18n.js';
import { highlight } from '../lint/highlight.js';
import { byLine, findingKey } from '../lint/inspect.js';
import { ParseTag, Tag } from './Tag.js';

export type SheetMode = 'inspect' | 'edit';

interface SheetProps {
  mode: SheetMode;
  source: string;
  fileName: string;
  result: FileResult;
  ruleFilter: string | null;
  openKey: string | null;
  onToggleTag(key: string): void;
  onSourceChange(source: string): void;
  onDropFile(file: File): void;
}

/** The part on the bench: the source with its line numbers, and a tag hanging on every flagged line. */
export function SourceSheet(props: SheetProps) {
  const { mode, source, fileName, result, ruleFilter, openKey, onToggleTag, onSourceChange, onDropFile } = props;
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);
  const lines = useMemo(() => highlight(source), [source]);
  const flagged = useMemo(
    () => byLine(result.findings.filter((f) => ruleFilter === null || f.ruleId === ruleFilter)),
    [result.findings, ruleFilter],
  );

  // A parser can stop past the last line (an unclosed block); hang that tag on the last line.
  const errorLine = result.error ? Math.min(result.error.line, lines.length) : 0;

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  return (
    <section className="sheet" aria-labelledby="sheet-title" onDragOver={onDragOver} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <header className="sheet__head">
        <h2 id="sheet-title" className="sheet__title">
          {t('sheet.label')}
        </h2>
        <span className="sheet__file">{fileName}</span>
        <span className="sheet__count">{t('sheet.lines', { count: source ? lines.length : 0 })}</span>
      </header>
      {mode === 'edit' ? (
        <textarea
          id="source"
          className="sheet__editor"
          aria-label={t('sheet.editLabel')}
          placeholder={t('sheet.placeholder')}
          value={source}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          onChange={(e) => onSourceChange(e.target.value)}
        />
      ) : source.trim() === '' ? (
        <p id="source" className="sheet__empty">
          {t('sheet.empty')}
        </p>
      ) : (
        <ol id="source" className="sheet__lines" tabIndex={-1}>
          {lines.map((tokens, i) => {
            const n = i + 1;
            const here = flagged.get(n);
            const parse = result.error && errorLine === n ? result.error : undefined;
            const level = parse ? 'error' : here?.some((f) => f.level === 'error') ? 'error' : here?.[0]?.level;
            return (
              <li key={n} className="line" data-flag={level}>
                <span className="line__no" aria-hidden="true">
                  {n}
                </span>
                <code className="line__code">
                  {tokens.length === 0
                    ? '​'
                    : tokens.map((tok, j) =>
                        tok.kind === 'plain' ? (
                          tok.text
                        ) : (
                          <span key={j} className={`tk-${tok.kind}`}>
                            {tok.text}
                          </span>
                        ),
                      )}
                </code>
                {here || parse ? (
                  <div className="line__tags" role="group" aria-label={t('sheet.lineFindings', { count: (here?.length ?? 0) + (parse ? 1 : 0), line: n })}>
                    {parse ? <ParseTag line={parse.line} column={parse.column} message={parse.message} /> : null}
                    {here?.map((f) => {
                      const key = findingKey(f);
                      return <Tag key={key} finding={f} open={openKey === key} onToggle={onToggleTag} />;
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {dragging ? (
        <div className="sheet__drop" aria-hidden="true">
          {t('sheet.drop')}
        </div>
      ) : null}
    </section>
  );
}
