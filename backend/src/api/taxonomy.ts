import { Router, Request, Response } from 'express';
import { TaxonomyService } from '../taxonomy/taxonomy';

const router = Router();
const taxonomyService = new TaxonomyService();

// GET /v1/taxonomy/tree
router.get('/tree', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const includeStats = req.query.includeStats === 'true';

  const tree = taxonomyService.getTree({ category, includeStats });
  res.json({ data: tree });
});

// GET /v1/taxonomy/tags
router.get('/tags', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;

  const tags = taxonomyService.getTags({ category });
  res.json({ data: tags, total: tags.length });
});

// GET /v1/taxonomy/suggest?q=partial
router.get('/suggest', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;

  if (!q || q.trim().length === 0) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  const suggestions = taxonomyService.suggestTags(q);
  res.json({ data: suggestions, total: suggestions.length });
});

// POST /v1/taxonomy/match
router.post('/match', (req: Request, res: Response) => {
  const { capabilities } = req.body;

  if (!capabilities || !Array.isArray(capabilities)) {
    res.status(400).json({ error: '"capabilities" must be a non-empty array of strings' });
    return;
  }

  if (capabilities.length === 0) {
    res.status(400).json({ error: '"capabilities" must be a non-empty array of strings' });
    return;
  }

  for (const cap of capabilities) {
    if (typeof cap !== 'string') {
      res.status(400).json({ error: 'Each capability must be a string' });
      return;
    }
  }

  const matches = taxonomyService.matchCapabilities(capabilities);
  res.json({ data: matches, total: matches.length });
});

// GET /v1/taxonomy/related/:tagId
router.get('/related/:tagId', (req: Request, res: Response) => {
  const { tagId } = req.params;

  const related = taxonomyService.getRelated(tagId as string);
  res.json({ data: related, total: related.length });
});

// POST /v1/taxonomy/resolve-aliases
router.post('/resolve-aliases', (req: Request, res: Response) => {
  const { aliases } = req.body;

  if (!aliases || !Array.isArray(aliases)) {
    res.status(400).json({ error: '"aliases" must be an array of strings' });
    return;
  }

  const resolved = taxonomyService.resolveAliases(aliases);
  res.json({ data: resolved });
});

export default router;
