/**
 * BotAutoTask — Google Research Harness² Engine (library subset).
 * Implements the durable part of "Harness²: Recursive Agent Harnessing for an Open World"
 * (arXiv:2610.14224) that pays for itself in a single-machine orchestrator:
 * 1. Experience Library R: { cue, lesson, evidence } triples saved to disk (core/library.py).
 * 2. Autotrigger discovery: registers discovered skills into guardrails (c2).
 * 3. Path validation ported from normalize_rel (core/tree.py): rejects any '..' segment,
 *    Windows and POSIX separators alike.
 *
 * Đính chính so với Spec 04 (đối chiếu harness2/core/*.py): Probe KHÔNG dùng git worktree
 * (thư mục staged riêng), thư viện KHÔNG đồng bộ cloud, Compose là phiên LLM gộp cây —
 * nên Propose–Probe–Compose không được triển khai ở đây (YAGNI, xem Spec 08 §D0).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { atomicWriteFileSync } from './atomic-write.js';

export class Harness2Engine {
  constructor({ workspaceDir = process.cwd(), alwaysOnMaxChars = 24000 } = {}) {
    this.workspaceDir = resolve(workspaceDir);
    this.alwaysOnMaxChars = alwaysOnMaxChars;
    this.libraryDir = join(this.workspaceDir, '.botautotask', 'library');
  }

  /**
   * Validates relative paths inside the surface tree.
   * Splits on both separators and rejects any '..' segment (ports normalize_rel),
   * so 'a/../../x' and 'a\..\..\x' are both refused on every platform.
   */
  validatePath(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return false;
    const str = String(relativePath).trim();
    if (str.length === 0) return false;
    if (str.startsWith('/') || str.startsWith('\\') || /^[a-zA-Z]:/.test(str)) {
      return false; // Absolute or drive/root-relative path
    }
    const segments = str.split(/[/\\]+/).filter((s) => s.length > 0);
    if (segments.length === 0) return false;
    if (segments.some((s) => s === '..' || s === '.')) return false;
    return true;
  }

  /**
   * Scans discovered skills and builds auto-trigger lines for guardrails (c2).
   */
  generateAutotriggers(skills = []) {
    const lines = [];
    for (const skill of skills) {
      if (skill.name && skill.description) {
        lines.push(`- When ${skill.description}, load the ${skill.name} skill.`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Saves an experience triple { cue, lesson, evidence } to the on-disk library.
   * Missing fields are a silent no-op ({ saved: false }), mirroring library.py — never throws.
   */
  saveExperience({ domain = 'general', name, cue, lesson, evidence } = {}) {
    if (!name || !cue || !lesson || !evidence) {
      return { saved: false, reason: 'MISSING_FIELDS' };
    }
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'general';
    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || `exp-${Date.now().toString(36)}`;
    const targetDir = join(this.libraryDir, cleanDomain);
    try {
      mkdirSync(targetDir, { recursive: true });
      const content = `# EXPERIENCE ENTRY: ${cleanName}
- **Cue:** ${cue}
- **Lesson:** ${lesson}
- **Evidence:** ${evidence}
`;
      const targetFile = join(targetDir, `${cleanName}.md`);
      atomicWriteFileSync(targetFile, content, 'utf8');
      return { saved: true, file: targetFile };
    } catch (err) {
      return { saved: false, reason: err.message };
    }
  }

  /**
   * Loads experiences for a domain, newest first (mtime), stopping before maxChars total.
   * If the single newest entry alone exceeds the budget, it is head-truncated to fit.
   */
  loadExperiences(domain = 'general', { maxChars = 4000 } = {}) {
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'general';
    const targetDir = join(this.libraryDir, cleanDomain);
    if (!existsSync(targetDir)) return [];

    let files = [];
    try {
      files = readdirSync(targetDir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => {
          let mtimeMs = 0;
          try {
            mtimeMs = statSync(join(targetDir, f)).mtimeMs;
          } catch {}
          return { f, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch {
      return [];
    }

    const entries = [];
    let total = 0;
    for (const { f } of files) {
      let text = '';
      try {
        text = readFileSync(join(targetDir, f), 'utf8');
      } catch {
        continue;
      }
      if (entries.length === 0 && text.length > maxChars) {
        entries.push(`${text.slice(0, maxChars)}…[truncated]`);
        break;
      }
      if (total + text.length > maxChars) break;
      entries.push(text);
      total += text.length;
    }
    return entries;
  }
}
