/**
 * BotAutoTask — Google Research Harness² Engine.
 * Implements "Harness²: Recursive Agent Harnessing for an Open World" (arXiv:2610.14224).
 * Features:
 * 1. 8-Component Surface Tree (c1..c8): system prompt, guardrails, memory, tools, subagents, skills, verifiers, hooks.
 * 2. Autotrigger discovery: Automatically registers discovered skills into guardrails.
 * 3. Two-Level Recursion:
 *    - Task-Level: Propose -> Probe (Invariant & Domain worktrees) -> Compose
 *    - System-Level: Experience Library R with { cue, lesson, evidence } triples
 * 4. Context Budget & Path Validation: Rejects path escapes (..) and enforces always_on limits.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, isAbsolute, normalize } from 'node:path';

export const SURFACE_COMPONENTS = {
  C1_SYSTEM_PROMPT: 'c1_system_prompt',
  C2_GUARDRAILS: 'c2_guardrails',
  C3_LONG_TERM_MEMORY: 'c3_long_term_memory',
  C4_TOOL_GUIDANCE: 'c4_tool_guidance',
  C5_SUBAGENTS: 'c5_subagents',
  C6_SKILLS: 'c6_skills',
  C7_VERIFIERS: 'c7_verifiers',
  C8_HOOKS: 'c8_hooks'
};

export class Harness2Engine {
  constructor({ workspaceDir = process.cwd(), alwaysOnMaxChars = 24000 } = {}) {
    this.workspaceDir = resolve(workspaceDir);
    this.alwaysOnMaxChars = alwaysOnMaxChars;
    this.libraryDir = join(this.workspaceDir, '.botautotask', 'library');
  }

  /**
   * Validates relative file paths within the surface tree.
   * Prevents directory escape (..) and unauthorized paths across Windows and POSIX.
   */
  validatePath(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return false;
    const str = String(relativePath).trim();
    if (str.startsWith('/') || str.startsWith('\\') || /^[a-zA-Z]:/.test(str)) {
      return false; // Absolute or root-relative path
    }
    const norm = normalize(str);
    if (isAbsolute(norm) || norm.startsWith('..') || norm.startsWith(`..${normalize('/')}`)) {
      return false;
    }
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
   * Validates that total always-on components (c1 + c2 + c3) do not exceed context window limits.
   */
  validateContextBudget(components = {}) {
    let totalChars = 0;
    for (const [key, content] of Object.entries(components)) {
      if ([SURFACE_COMPONENTS.C1_SYSTEM_PROMPT, SURFACE_COMPONENTS.C2_GUARDRAILS, SURFACE_COMPONENTS.C3_LONG_TERM_MEMORY].includes(key)) {
        totalChars += String(content || '').length;
      }
    }
    return {
      valid: totalChars <= this.alwaysOnMaxChars,
      totalChars,
      maxChars: this.alwaysOnMaxChars
    };
  }

  /**
   * Composes Invariant Probe and Domain Probe outputs into a unified refined Harness H*.
   */
  composeProbes({ invariantProbe = {}, domainProbe = {} } = {}) {
    const verified = invariantProbe.testPassed === true;
    return {
      success: verified,
      harness: {
        codeChanges: domainProbe.codeChanges || [],
        verifiers: invariantProbe.verifiers || [],
        guardrails: [
          ...(domainProbe.guardrails || []),
          ...(invariantProbe.guardrails || [])
        ],
        skills: domainProbe.skills || []
      },
      summary: verified
        ? 'Domain implementation verified against Invariant Probe verifiers.'
        : 'Invariant verification failed. Refinements required.'
    };
  }

  /**
   * Saves an experience entry triple: { cue, lesson, evidence }
   */
  saveExperience({ domain = 'general', name, cue, lesson, evidence }) {
    if (!cue || !lesson || !evidence) {
      throw new Error('Experience entry must contain cue, lesson, and evidence.');
    }
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cleanName = String(name || `exp-${Date.now().toString(36)}`).replace(/[^a-z0-9_-]/g, '-');
    const targetDir = join(this.libraryDir, cleanDomain);
    mkdirSync(targetDir, { recursive: true });

    const content = `# EXPERIENCE ENTRY: ${cleanName}
- **Cue:** ${cue}
- **Lesson:** ${lesson}
- **Evidence:** ${evidence}
`;
    const targetFile = join(targetDir, `${cleanName}.md`);
    writeFileSync(targetFile, content, 'utf8');
    return { saved: true, file: targetFile };
  }

  /**
   * Loads all experiences for a given domain into a prompt-ready format.
   */
  loadExperiences(domain = 'general') {
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const targetDir = join(this.libraryDir, cleanDomain);
    if (!existsSync(targetDir)) return [];

    const entries = [];
    try {
      const files = readdirSync(targetDir).filter((f) => f.endsWith('.md'));
      for (const f of files) {
        const text = readFileSync(join(targetDir, f), 'utf8');
        entries.push(text);
      }
    } catch {}
    return entries;
  }
}
