import { config } from './config.js';

// Every .sol file under fixtures/, as text. config/app.json picks which ones the playground offers.
const files = import.meta.glob<string>('../../fixtures/**/*.sol', { query: '?raw', import: 'default', eager: true });

export interface LoadedSample {
  id: string;
  fileName: string;
  source: string;
}

/** The examples named in config/app.json, in that order. A missing file is a build error, not a silent gap. */
export const samples: readonly LoadedSample[] = config.playground.samples.map(({ id, file }) => {
  const source = files[`../../${file}`];
  if (source === undefined) throw new Error(`config/app.json names a sample that does not exist: ${file}`);
  return { id, fileName: file.split('/').pop() ?? file, source };
});
