import taxonomyData from './tags.json';

interface TaxonomyTag {
  id: string;
  label: string;
  aliases: string[];
  related_tags: string[];
  category_path: string;
  stats?: TagStats;
}

interface TagStats {
  jobCount: number;
  avgBudget: number;
  successRate: number;
}

interface TaxonomyNode {
  id: string;
  label: string;
  tags?: TaxonomyTag[];
  children?: TaxonomyNode[];
  stats?: { totalJobs: number; avgBudget: number };
}

interface MatchResult {
  capability: string;
  matchedTag: TaxonomyTag;
  matchType: 'exact' | 'alias' | 'related';
  opportunityScore: number;
}

interface RawTag {
  id: string;
  label: string;
  aliases: string[];
  related_tags: string[];
}

interface RawNode {
  id: string;
  label: string;
  tags?: RawTag[];
  children?: RawNode[];
}

export class TaxonomyService {
  private flatTags: Map<string, TaxonomyTag> = new Map();
  private aliasMap: Map<string, string> = new Map();
  private tree: TaxonomyNode[];

  constructor() {
    this.tree = this.buildTree(taxonomyData.categories as RawNode[], '');
    this.buildFlatIndex();
  }

  private buildTree(nodes: RawNode[], parentPath: string): TaxonomyNode[] {
    return nodes.map((node) => {
      const currentPath = parentPath ? `${parentPath} > ${node.label}` : node.label;
      const result: TaxonomyNode = {
        id: node.id,
        label: node.label,
      };

      if (node.tags) {
        result.tags = node.tags.map((tag) => ({
          id: tag.id,
          label: tag.label,
          aliases: tag.aliases,
          related_tags: tag.related_tags,
          category_path: currentPath,
        }));
      }

      if (node.children) {
        result.children = this.buildTree(node.children, currentPath);
      }

      return result;
    });
  }

  private buildFlatIndex(): void {
    const walk = (nodes: TaxonomyNode[]): void => {
      for (const node of nodes) {
        if (node.tags) {
          for (const tag of node.tags) {
            this.flatTags.set(tag.id, tag);
            for (const alias of tag.aliases) {
              this.aliasMap.set(alias.toLowerCase(), tag.id);
            }
          }
        }
        if (node.children) {
          walk(node.children);
        }
      }
    };
    walk(this.tree);
  }

  getTree(options?: { category?: string; includeStats?: boolean }): TaxonomyNode[] {
    if (!options?.category) {
      return this.tree;
    }

    const filterTree = (nodes: TaxonomyNode[]): TaxonomyNode[] => {
      const results: TaxonomyNode[] = [];
      for (const node of nodes) {
        if (node.id === options.category || node.id.startsWith(options.category + '.')) {
          results.push(node);
        } else if (node.children) {
          const filtered = filterTree(node.children);
          if (filtered.length > 0) {
            results.push({ ...node, children: filtered });
          }
        }
      }
      return results;
    };

    return filterTree(this.tree);
  }

  getTags(filters?: { category?: string }): TaxonomyTag[] {
    if (!filters?.category) {
      return Array.from(this.flatTags.values());
    }

    const results: TaxonomyTag[] = [];
    const collectTags = (nodes: TaxonomyNode[]): void => {
      for (const node of nodes) {
        if (node.id === filters.category || node.id.startsWith(filters.category + '.')) {
          if (node.tags) {
            results.push(...node.tags);
          }
          if (node.children) {
            collectTags(node.children);
          }
        } else if (node.children) {
          collectTags(node.children);
        }
      }
    };
    collectTags(this.tree);
    return results;
  }

  suggestTags(partial: string): TaxonomyTag[] {
    if (!partial || partial.trim().length === 0) {
      return [];
    }

    const query = partial.toLowerCase().trim();
    const scored: { tag: TaxonomyTag; score: number }[] = [];

    for (const tag of this.flatTags.values()) {
      let bestScore = 0;

      // Exact id match
      if (tag.id.toLowerCase() === query) {
        bestScore = 100;
      }
      // Exact label match
      else if (tag.label.toLowerCase() === query) {
        bestScore = 95;
      }
      // Id prefix match
      else if (tag.id.toLowerCase().startsWith(query)) {
        bestScore = 80;
      }
      // Label prefix match
      else if (tag.label.toLowerCase().startsWith(query)) {
        bestScore = 75;
      }
      // Alias exact match
      else if (tag.aliases.some((a) => a.toLowerCase() === query)) {
        bestScore = 70;
      }
      // Alias prefix match
      else if (tag.aliases.some((a) => a.toLowerCase().startsWith(query))) {
        bestScore = 60;
      }
      // Id substring match
      else if (tag.id.toLowerCase().includes(query)) {
        bestScore = 50;
      }
      // Label substring match
      else if (tag.label.toLowerCase().includes(query)) {
        bestScore = 45;
      }
      // Alias substring match
      else if (tag.aliases.some((a) => a.toLowerCase().includes(query))) {
        bestScore = 40;
      }

      if (bestScore > 0) {
        scored.push({ tag, score: bestScore });
      }
    }

    scored.sort((a, b) => b.score - a.score || a.tag.label.localeCompare(b.tag.label));
    return scored.map((s) => s.tag);
  }

  matchCapabilities(capabilities: string[]): MatchResult[] {
    const results: MatchResult[] = [];
    const seen = new Set<string>();

    for (const capability of capabilities) {
      const normalized = capability.toLowerCase().trim();
      const key = normalized;

      // 1. Exact match on tag id
      const exactTag = this.flatTags.get(normalized);
      if (exactTag && !seen.has(`${key}:${exactTag.id}`)) {
        seen.add(`${key}:${exactTag.id}`);
        results.push({
          capability,
          matchedTag: exactTag,
          matchType: 'exact',
          opportunityScore: 1.0,
        });
        continue;
      }

      // 2. Alias match
      const canonicalId = this.aliasMap.get(normalized);
      if (canonicalId) {
        const aliasTag = this.flatTags.get(canonicalId);
        if (aliasTag && !seen.has(`${key}:${aliasTag.id}`)) {
          seen.add(`${key}:${aliasTag.id}`);
          results.push({
            capability,
            matchedTag: aliasTag,
            matchType: 'alias',
            opportunityScore: 0.8,
          });
          continue;
        }
      }

      // 3. Related tag match: check if any tag lists this capability as a related tag
      for (const tag of this.flatTags.values()) {
        if (tag.related_tags.some((r) => r.toLowerCase() === normalized)) {
          if (!seen.has(`${key}:${tag.id}`)) {
            seen.add(`${key}:${tag.id}`);
            results.push({
              capability,
              matchedTag: tag,
              matchType: 'related',
              opportunityScore: 0.5,
            });
          }
        }
      }
    }

    results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    return results;
  }

  resolveAliases(input: string[]): string[] {
    return input.map((item) => {
      const normalized = item.toLowerCase().trim();
      const canonicalId = this.aliasMap.get(normalized);
      if (canonicalId) {
        return canonicalId;
      }
      // If it's already a canonical tag id, return as-is
      if (this.flatTags.has(normalized)) {
        return normalized;
      }
      // Return the original input if no match found
      return item;
    });
  }

  getRelated(tagId: string): TaxonomyTag[] {
    const tag = this.flatTags.get(tagId);
    if (!tag) {
      return [];
    }

    const related: TaxonomyTag[] = [];
    const seen = new Set<string>();

    for (const relatedId of tag.related_tags) {
      const relatedTag = this.flatTags.get(relatedId);
      if (relatedTag && !seen.has(relatedTag.id)) {
        seen.add(relatedTag.id);
        related.push(relatedTag);
      }
    }

    return related;
  }
}
