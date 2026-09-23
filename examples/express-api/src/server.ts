import express from 'express';
import { Pipeline } from '@reviewpipe/core';
import { CsvAdapter } from '@reviewpipe/adapter-csv';
import { LexiconProvider } from '@reviewpipe/provider-lexicon';

const app = express();

// Accept the raw CSV as the request body regardless of content type, e.g.
// `curl --data-binary @reviews.csv http://localhost:3000/analyze`.
app.use(express.text({ type: '*/*', limit: '5mb' }));

app.post('/analyze', async (req, res) => {
  const csv = typeof req.body === 'string' ? req.body : '';
  if (csv.trim() === '') {
    res.status(400).json({ error: 'POST a CSV body (with an id and text column).' });
    return;
  }

  try {
    const result = await new Pipeline()
      .source(new CsvAdapter())
      .provider(new LexiconProvider())
      .run(csv);
    res.json(result);
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  process.stdout.write(`reviewpipe example API listening on http://localhost:${port}\n`);
});
