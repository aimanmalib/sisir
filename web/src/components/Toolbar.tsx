import { useId } from 'react';
import { useI18n } from '../i18n/i18n.js';
import { samples } from '../samples.js';
import { ClearIcon, UploadIcon } from './icons.js';
import type { SheetMode } from './SourceSheet.js';

interface ToolbarProps {
  sampleId: string | null;
  /** Shown in the example list when the source is not an example. */
  fileName: string;
  mode: SheetMode;
  onSample(id: string): void;
  onFile(file: File): void;
  onMode(mode: SheetMode): void;
  onClear(): void;
}

/** Load an example or a file, switch between reading and editing, or start over. */
export function Toolbar({ sampleId, fileName, mode, onSample, onFile, onMode, onClear }: ToolbarProps) {
  const { t } = useI18n();
  const selectId = useId();
  const uploadId = useId();
  return (
    <div className="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
      <div className="field">
        <label className="field__label" htmlFor={selectId}>
          {t('toolbar.example')}
        </label>
        <select id={selectId} className="select" value={sampleId ?? ''} onChange={(e) => e.target.value && onSample(e.target.value)}>
          {sampleId === null ? <option value="">{fileName}</option> : null}
          {samples.map((s) => (
            <option key={s.id} value={s.id}>
              {t(`sample.${s.id}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="btn" htmlFor={uploadId}>
        <UploadIcon />
        <span>{t('toolbar.upload')}</span>
        <input
          id={uploadId}
          className="visually-hidden"
          type="file"
          accept=".sol,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
      </label>
      <div className="segmented" role="group" aria-label={`${t('toolbar.inspect')} / ${t('toolbar.edit')}`}>
        {(['inspect', 'edit'] as const).map((m) => (
          <button key={m} type="button" className="segmented__opt" aria-pressed={mode === m} onClick={() => onMode(m)}>
            {t(`toolbar.${m}`)}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--quiet" onClick={onClear}>
        <ClearIcon />
        <span>{t('toolbar.clear')}</span>
      </button>
    </div>
  );
}
