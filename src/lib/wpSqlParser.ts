export interface ParsedWpUser {
  wp_id: number;
  user_login: string;
  user_pass: string;
  user_email: string;
  user_registered: string;
  display_name: string;
}

export interface ParsedWpUserMeta {
  user_id: number;
  meta_key: string;
  meta_value: string;
}

export interface MergedWpUser {
  wp_id: number;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  registered: string;
  is_paying_customer: boolean;
}

/**
 * Parse a MySQL INSERT VALUES block to extract individual value tuples.
 * Handles escaped quotes inside strings.
 */
function extractValueTuples(sql: string): string[][] {
  const results: string[][] = [];
  
  // Find all INSERT INTO statements and their VALUES
  const insertRegex = /INSERT INTO [`']?\w+[`']?\s*\([^)]+\)\s*VALUES\s*/gi;
  let match;
  
  while ((match = insertRegex.exec(sql)) !== null) {
    let pos = match.index + match[0].length;
    
    while (pos < sql.length) {
      // Skip whitespace
      while (pos < sql.length && /\s/.test(sql[pos])) pos++;
      
      if (sql[pos] !== '(') break;
      
      // Extract one tuple
      pos++; // skip opening (
      const values: string[] = [];
      let current = '';
      let inString = false;
      let stringChar = '';
      let depth = 0;
      
      while (pos < sql.length) {
        const ch = sql[pos];
        
        if (inString) {
          if (ch === '\\' && pos + 1 < sql.length) {
            current += ch + sql[pos + 1];
            pos += 2;
            continue;
          }
          if (ch === stringChar && pos + 1 < sql.length && sql[pos + 1] === stringChar) {
            // Escaped quote by doubling
            current += ch;
            pos += 2;
            continue;
          }
          if (ch === stringChar) {
            inString = false;
            pos++;
            continue;
          }
          current += ch;
          pos++;
        } else {
          if (ch === '\'' || ch === '"') {
            inString = true;
            stringChar = ch;
            pos++;
          } else if (ch === '(') {
            depth++;
            current += ch;
            pos++;
          } else if (ch === ')') {
            if (depth > 0) {
              depth--;
              current += ch;
              pos++;
            } else {
              // End of tuple
              values.push(current.trim());
              results.push(values);
              pos++; // skip )
              break;
            }
          } else if (ch === ',' && depth === 0) {
            values.push(current.trim());
            current = '';
            pos++;
          } else {
            current += ch;
            pos++;
          }
        }
      }
      
      // Skip comma or semicolon between tuples
      while (pos < sql.length && /[\s,]/.test(sql[pos])) pos++;
      if (pos < sql.length && sql[pos] === ';') break;
    }
  }
  
  return results;
}

function cleanValue(val: string): string {
  if (val === 'NULL' || val === '') return '';
  // Remove surrounding quotes
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    val = val.slice(1, -1);
  }
  // Unescape
  return val.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export function parseWpUsers(sql: string): ParsedWpUser[] {
  const tuples = extractValueTuples(sql);
  const users: ParsedWpUser[] = [];
  
  for (const values of tuples) {
    if (values.length < 10) continue;
    
    users.push({
      wp_id: parseInt(values[0], 10),
      user_login: cleanValue(values[1]),
      user_pass: cleanValue(values[2]),
      user_email: cleanValue(values[4]),
      user_registered: cleanValue(values[6]),
      display_name: cleanValue(values[9]),
    });
  }
  
  return users;
}

export function parseWpUserMeta(sql: string): ParsedWpUserMeta[] {
  const tuples = extractValueTuples(sql);
  const metas: ParsedWpUserMeta[] = [];
  
  const relevantKeys = new Set([
    'first_name', 'last_name', 'billing_email', 'paying_customer',
    'billing_first_name', 'billing_last_name'
  ]);
  
  for (const values of tuples) {
    if (values.length < 4) continue;
    
    const metaKey = cleanValue(values[2]);
    if (!relevantKeys.has(metaKey)) continue;
    
    metas.push({
      user_id: parseInt(values[1], 10),
      meta_key: metaKey,
      meta_value: cleanValue(values[3]),
    });
  }
  
  return metas;
}

export function mergeUsersAndMeta(
  users: ParsedWpUser[],
  metas: ParsedWpUserMeta[]
): MergedWpUser[] {
  // Group meta by user_id
  const metaMap = new Map<number, Map<string, string>>();
  for (const meta of metas) {
    if (!metaMap.has(meta.user_id)) {
      metaMap.set(meta.user_id, new Map());
    }
    metaMap.get(meta.user_id)!.set(meta.meta_key, meta.meta_value);
  }
  
  return users
    .filter((u) => u.user_email && u.user_email.includes('@'))
    .map((u) => {
      const userMeta = metaMap.get(u.wp_id);
      const firstName = userMeta?.get('first_name') || userMeta?.get('billing_first_name') || '';
      const lastName = userMeta?.get('last_name') || userMeta?.get('billing_last_name') || '';
      
      return {
        wp_id: u.wp_id,
        email: u.user_email.toLowerCase().trim(),
        display_name: u.display_name || u.user_login,
        first_name: firstName,
        last_name: lastName,
        password_hash: u.user_pass,
        registered: u.user_registered,
        is_paying_customer: userMeta?.get('paying_customer') === '1',
      };
    });
}
