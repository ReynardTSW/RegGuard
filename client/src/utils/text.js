const LEADING_MARKERS = /^\s*(\([a-z0-9]+\)|[a-z0-9]+\.)\s*/i;
const MODAL_PATTERN = /\b(shall not|must not|shall|must|may|is required to)\b/i;
const LIST_ITEM_PATTERN = /\(([a-z])\)\s*/gi;
const ARTIFACT_PATTERNS = [
  /Singapore Statutes Online.*$/i,
  /PDF created date.*$/i,
];

const splitListItems = (text) => {
  const matches = [];
  let match;
  while ((match = LIST_ITEM_PATTERN.exec(text)) !== null) {
    matches.push({ index: match.index, label: match[1] });
  }
  if (matches.length === 0) return null;

  const leadIn = text.slice(0, matches[0].index).trim();
  const items = matches.map((m, idx) => {
    const start = m.index + 3; // "(a)" + space
    const end = idx + 1 < matches.length ? matches[idx + 1].index : text.length;
    let raw = text.slice(start, end).trim().replace(/;$/, '');
    ARTIFACT_PATTERNS.forEach((pat) => {
      raw = raw.replace(pat, '').trim();
    });
    return { label: m.label, text: raw };
  });
  return { leadIn, items };
};

const normalizeAction = (text) => {
  const cleaned = text.replace(LEADING_MARKERS, '').trim();
  if (cleaned.toLowerCase().startsWith('to ')) {
    return cleaned.slice(3).trim();
  }
  return cleaned;
};

const parseActorModal = (text) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const modalMatch = normalized.match(MODAL_PATTERN);
  if (!modalMatch) return null;
  const modal = modalMatch[0].toLowerCase();
  const modalIndex = modalMatch.index ?? 0;
  const before = normalized.slice(0, modalIndex).trim();
  const after = normalized.slice(modalIndex + modal.length).trim();
  const actorMatch = before.match(/\b(the\s+)?(commission|organisation|organization|authority|individual|person|applicant|data intermediary|controller|processor)\b/i);
  const actor = actorMatch ? actorMatch[0].replace(/\bthe\s+/i, '').trim() : before || 'Actor';
  let polarity = 'must';
  if (modal === 'may') polarity = 'can';
  if (modal === 'shall not' || modal === 'must not') polarity = 'must not';
  return { actor: actor.charAt(0).toUpperCase() + actor.slice(1), modal, after, polarity };
};

export const toActionStatement = (text) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const listSplit = splitListItems(normalized);
  const parsed = parseActorModal(normalized);

  if (listSplit && parsed) {
    const actions = listSplit.items.map((item) => {
      const action = normalizeAction(item.text);
      const cap = action.charAt(0).toUpperCase() + action.slice(1);
      return `${item.label.toUpperCase()}) ${cap}`;
    });
    return `${parsed.actor} ${parsed.polarity} ${actions.join('; ')}.`;
  }

  if (listSplit) {
    const actions = listSplit.items.map((item) => {
      const action = normalizeAction(item.text);
      const cap = action.charAt(0).toUpperCase() + action.slice(1);
      return `${item.label.toUpperCase()}) ${cap}`;
    });
    return actions.join('; ');
  }

  if (parsed) {
    const cleanedAfter = normalizeAction(parsed.after).replace(/^[,.;:-]\s*/, '');
    const sentence = `${parsed.actor} ${parsed.polarity} ${cleanedAfter}`.replace(/\s+/g, ' ').trim();
    const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
  }

  const capitalized =
    normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
};

export const extractCoreObligations = (text) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const listSplit = splitListItems(normalized);
  if (listSplit) {
    return listSplit.items.map(
      (item) => `(${item.label}) ${item.text}`.trim()
    );
  }
  const parts = normalized.split(';').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [normalized];
};

const shorten = (s, limit = 90) => {
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : limit)}…`;
};

export const toActionList = (text) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const listSplit = splitListItems(normalized);
  if (listSplit) {
    return listSplit.items.map((item) => {
      const action = normalizeAction(item.text);
      const cap = action.charAt(0).toUpperCase() + action.slice(1);
      return `${item.label.toUpperCase()}) ${shorten(cap, 80)}`;
    });
  }
  return [shorten(toActionStatement(text), 80)];
};

export const summarizeRule = (text) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const actions = toActionList(normalized);
  const actorStrip = (s) =>
    s.replace(/^(the\s+)?(organisation|organization|commission|authority|applicant|individual|person|controller|processor)\s+(must|must not|can|may)\s+/i, '').trim();

  if (actions.length > 0) {
    const main = actorStrip(actions[0].replace(/^[A-Z]\)\s*/, ''));
    const words = main.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
    if (words) return words.replace(/[,;:.]+$/, '');
  }
  const parsed = parseActorModal(normalized);
  let key = normalized.replace(LEADING_MARKERS, '');
  if (parsed) key = actorStrip(normalizeAction(parsed.after) || key);
  const words = key.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  return words ? words.replace(/[,;:.]+$/, '') : 'Rule';
};
