// Builders of the Visa DS Bridge. Evaluated by the DS Bridge core on every build with its toolkit T
// (fr, txt, inst, instByName, importByName, bindVar, fillVar, writeText, setInstText, layout,
// target/setTarget, BP, ROOT, LOG, NONLIB). Every value below comes from layout.json or rules.json of
// this pack; variable names are the library's own (inventory/foundations.json, collection Theme colors,
// Shape, Padding). The pages are built piece by piece: a layout builder places the navigation and
// opens the content column; every section after it lands there, so the camera follows each piece.
T => {
  const L = T.layout || {};
  const VAR = {
    surface: 'Color/Surface/surface-1', surface2: 'Color/Surface/surface-2', border: 'Color/Decorative/border',
    text: 'Color/Text/text', textSubtle: 'Color/Text/text-subtle',
    radius: 'large',                     // Shape collection: 8 in Rounded (default)
    pad: 'size-300',                     // Padding collection: 24 in Default density (factor of four, rule L5)
  };
  const grid = L.grid || {};
  const nav = (L.navigation || {});
  const navW = (nav.vertical && nav.vertical.width) || 242;
  const horizH = (nav.horizontal && nav.horizontal.height) || 80;
  const gutter = grid.gutter || 24;
  const cols = grid.columns || 12;
  // Margin of the content area beside a vertical navigation, by page width (layout.json › grid.besideVerticalNav).
  const sideMargin = w => { const m = (grid.besideVerticalNav && grid.besideVerticalNav.margin) || {}; return w >= 1280 ? (m['1280'] || 32) : (m['1024'] || 24); };
  const topMargin = () => grid.margin || 24;

  const inner = () => T.BP.inner || (T.BP.w - 2 * (T.BP.margin || 24));
  const colU = () => (inner() - (cols - 1) * gutter) / cols;
  const span = n => Math.round(colU() * n + gutter * (n - 1));

  // Component properties of this kit end with a colon ("Label:", "App name:") and carry an id suffix:
  // match by prefix, ignoring case, so a SPEC can say "Label".
  const propKey = (i, name) => { const want = String(name).replace(/:$/, '').toLowerCase(); return Object.keys(i.componentProperties || {}).find(k => k.split('#')[0].replace(/:$/, '').toLowerCase() === want) || null; };
  const setProps = (i, props) => {
    const out = {};
    for (const [k, v] of Object.entries(props || {})) { const full = propKey(i, k); if (full) out[full] = v; else T.LOG.push('prop "' + k + '" not on ' + i.name); }
    if (Object.keys(out).length) { try { i.setProperties(out); } catch (e) { T.LOG.push('props on ' + i.name + ': ' + e.message); } }
  };
  const shown = (x, top) => { let p = x; while (p && p !== top) { if (!p.visible) return false; p = p.parent; } return true; };
  const textNamed = (root, re) => root.findOne(x => x.type === 'TEXT' && re.test(x.name) && shown(x, root));
  const write = async (root, re, value) => { const t = textNamed(root, re); if (t && value !== undefined && value !== null) await T.writeText(t, String(value)); else if (!t) T.LOG.push('no text ' + re + ' in ' + root.name); };
  const radius = async (n, name) => { for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) await T.bindVar(n, f, name); };
  const padAll = async (n, name) => { for (const f of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) await T.bindVar(n, f, name); };
  // A spacing value in px, bound to the variable of the pack's scale that has it (layout.json › spacing.variables);
  // a value the scale does not have stays a number (the audit asks nothing of it: there is nothing to bind to).
  const SPACE = (L.spacing && L.spacing.variables) || {};
  const space = async (n, prop, px) => { n[prop] = px; if (SPACE[String(px)]) await T.bindVar(n, prop, SPACE[String(px)]); };
  const spaceAll = async (n, px) => { for (const f of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight']) await space(n, f, px); };
  const fill = (n, v) => { try { n.layoutSizingHorizontal = v; } catch (e) {} };
  const equalize = cards => { const h = Math.max(...cards.map(c => c.height)); for (const c of cards) { try { c.layoutSizingVertical = 'FIXED'; c.resize(c.width, h); } catch (e) {} } };

  // The content column: a flush column (the footer lands at its full width) holding the content area
  // (surface-2, the margin of the frame). Every later section lands in the content area.
  let COLUMN = null;
  const openContent = async (parent, margin) => {
    const column = T.fr('content column', 'VERTICAL', parent); fill(column, 'FILL'); column.counterAxisAlignItems = 'MIN'; column.itemSpacing = 0;
    try { column.layoutSizingVertical = 'HUG'; } catch (e) {}
    const content = T.fr('content area', 'VERTICAL', column); fill(content, 'FILL'); content.counterAxisAlignItems = 'MIN';
    await space(content, 'itemSpacing', gutter);
    await T.fillVar(content, VAR.surface2);
    await spaceAll(content, margin);
    T.BP.margin = margin; T.BP.content = null; T.BP.inner = T.BP.w - 2 * margin;
    COLUMN = column;
    T.setTarget(content);
    return content;
  };

  // The kit's horizontal navigation (rule L6): app name and up to four L1 items; the skip link stays.
  const horizontalNav = async (parent, s) => {
    let i = null;
    try { i = await T.instByName('Horizontal navigation › Horizontal', parent); } catch (e) { T.LOG.push('horizontal nav: ' + e.message); return null; }
    fill(i, 'FILL');
    if (s.appName) await write(i, /^Application Name$/, s.appName);
    const items = s.items || [];
    for (let k = 0; k < 4; k++) {
      const t = textNamed(i, new RegExp('^L1 Label ' + (k + 1) + '$'));
      if (!t) continue;
      if (k < items.length) await T.writeText(t, items[k]); else { let p = t.parent; while (p && p.type !== 'INSTANCE') p = p.parent; try { if (p) p.visible = false; } catch (e) {} }
    }
    if (items.length > 4) T.LOG.push('horizontal nav: ' + (items.length - 4) + ' item(s) beyond the four slots (rule L6: at most seven, the kit shows four)');
    return i;
  };

  // The kit's vertical navigation (rule L6): app name, L1 items in the order given, user row at the bottom.
  const verticalNav = async (parent, s) => {
    let i = null;
    try { i = await T.instByName('Vertical nav default', parent); } catch (e) { T.LOG.push('vertical nav: ' + e.message); return null; }
    try { i.layoutSizingHorizontal = 'FIXED'; i.resize(navW, i.height); i.layoutSizingVertical = 'FILL'; } catch (e) {}
    if (s.appName) await write(i, /^Application Name$/, s.appName);
    // rows in the order the eye reads them (the kit's layer order does not follow the row numbers)
    const tabs = i.findAll(x => /^Vertical Tab \d+$/.test(x.name)).sort((a, b) => (a.absoluteBoundingBox || { y: 0 }).y - (b.absoluteBoundingBox || { y: 0 }).y);
    const items = s.items || [];
    for (let k = 0; k < tabs.length; k++) {
      const on = k < items.length;
      try { tabs[k].visible = on; } catch (e) {}
      if (!on) continue;
      const label = typeof items[k] === 'string' ? items[k] : items[k].label;
      const t = tabs[k].findOne(x => x.type === 'TEXT');
      if (t) await T.writeText(t, label);
      if (s.selected !== undefined) setProps(tabs[k], { Active: label === s.selected ? 'True' : 'False' });
    }
    if (items.length > tabs.length) T.LOG.push('vertical nav: ' + (items.length - tabs.length) + ' item(s) beyond the ' + tabs.length + ' rows of the kit');
    const user = i.findOne(x => /^User Profile$/i.test(x.name));
    if (user) { if (s.user) await write(user, /./, s.user); else { try { user.visible = false; } catch (e) {} } }
    return i;
  };

  // The kit's Default footer at the width of the content column (rule L7). {copyright}
  const footer = async (parent, s) => {
    let i = null;
    try { i = await T.instByName('Default footer', parent); } catch (e) { T.LOG.push('footer: ' + e.message); return null; }
    fill(i, 'FILL');
    if (s.copyright) await write(i, /^Copyright$/, s.copyright);
    return i;
  };

  return {
    // Vertical application layout (rule L1, L2): the vertical navigation on the left, the content
    // column on the right. {appName, items:[label], selected?, user?}
    async verticalLayout(s) {
      await T.fillVar(T.ROOT, VAR.surface2);
      const shell = T.fr('app shell', 'HORIZONTAL', T.target); fill(shell, 'FILL'); shell.counterAxisAlignItems = 'MIN'; shell.itemSpacing = 0;
      try { shell.layoutSizingVertical = 'HUG'; } catch (e) {}
      await verticalNav(shell, s);
      T.BP.w = T.BP.w - navW;
      await openContent(shell, sideMargin(T.BP.w + navW));
    },

    // Horizontal application layout: the horizontal navigation on top, the content column under it.
    // {appName, items:[label]}
    async horizontalLayout(s) {
      await T.fillVar(T.ROOT, VAR.surface2);
      await horizontalNav(T.target, s);
      await openContent(T.target, topMargin());
    },

    // Mixed application layout: horizontal navigation (global items) on top, vertical navigation (local
    // items) on the left, the content column beside it. {appName, items:[global], local:[label], selected?, user?}
    async mixedLayout(s) {
      await T.fillVar(T.ROOT, VAR.surface2);
      await horizontalNav(T.target, s);
      const shell = T.fr('app shell', 'HORIZONTAL', T.target); fill(shell, 'FILL'); shell.counterAxisAlignItems = 'MIN'; shell.itemSpacing = 0;
      await verticalNav(shell, { appName: s.appName, items: s.local || [], selected: s.selected, user: s.user });
      T.BP.w = T.BP.w - navW;
      await openContent(shell, sideMargin(T.BP.w + navW));
    },

    // The library footer inside the content column, as the kit's layouts place it. {copyright}
    async visaFooter(s) {
      // flush with the column, under the content area, as the kit's layouts place it
      const host = COLUMN || T.target;
      await footer(host, s || {});
      if (COLUMN) T.setTarget(COLUMN);
    },

    // A page title over the content: Headline 1 is the largest title of a page (rule T2). {title, body?}
    async pageHeader(s) {
      const h = T.fr('page header', 'VERTICAL', T.target); fill(h, 'FILL'); h.counterAxisAlignItems = 'MIN'; await space(h, 'itemSpacing', 8);
      const t = await T.txt(s.title, 'titleMD', 'elementPrimary', h); t.textAutoResize = 'HEIGHT'; fill(t, 'FILL');
      if (s.body) { const b = await T.txt(s.body, 'body', 'elementSecondary', h); b.textAutoResize = 'HEIGHT'; fill(b, 'FILL'); }
    },

    // A row of Content cards on the grid, equal heights (rule K5). {perRow, cards:[{headline, subhead?, text, action?}]}
    async contentCards(s) {
      const per = s.perRow || 3;
      const row = T.fr('content cards', 'HORIZONTAL', T.target); fill(row, 'FILL'); row.counterAxisAlignItems = 'MIN'; row.layoutWrap = 'WRAP'; await space(row, 'itemSpacing', gutter); await space(row, 'counterAxisSpacing', gutter);
      const CW = Math.floor((inner() - (per - 1) * gutter) / per);
      const made = [];
      for (const cd of s.cards || []) {
        let c = null;
        try { c = await T.instByName('Content card: Default', row); } catch (e) { T.LOG.push('content card: ' + e.message); continue; }
        try { c.layoutSizingHorizontal = 'FIXED'; c.resize(CW, c.height); } catch (e) {}
        // The card's slots (Headline, Text, Actions) are nested instances: their copy is written through the
        // visible text nodes the kit names Headline, Subtitle, Description and the action labels.
        await write(c, /^Headline$/, cd.headline);
        if (cd.subhead) await write(c, /^Subtitle$/, cd.subhead); else { const st = textNamed(c, /^Subtitle$/); if (st) { try { st.visible = false; } catch (e) {} } }
        await write(c, /^Description$/, cd.text);
        const btn = c.findOne(x => x.type === 'INSTANCE' && /text button$/i.test(x.name) && shown(x, c));
        if (btn) { if (cd.action) { setProps(btn, { Label: cd.action, 'Show leading icon': false, 'Show trailing icon': false }); } else { try { btn.visible = false; } catch (e) {} } }
        const lk = c.findOne(x => x.type === 'INSTANCE' && /^Link/i.test(x.name) && shown(x, c));
        if (lk) { if (cd.link) await write(lk, /^Label$/, cd.link); else { try { lk.visible = false; } catch (e) {} } }
        made.push(c);
      }
      if (made.length) equalize(made);
    },

    // A form card (kit › Form layout, rule K3): title, description, fields in order, buttons. Fields:
    // {kind:'input'|'select'|'textarea', label, value?, message?}. {title, body?, fields:[], primary, secondary?, tertiary?, width?}
    async formCard(s) {
      const card = T.fr('form card', 'VERTICAL', T.target); card.counterAxisAlignItems = 'MIN'; await space(card, 'itemSpacing', 24);
      const w = s.width || Math.min(inner(), span(6) + gutter);
      try { card.layoutSizingHorizontal = 'FIXED'; card.resize(w, 10); card.layoutSizingVertical = 'HUG'; } catch (e) {}
      await T.fillVar(card, VAR.surface); await radius(card, VAR.radius); await padAll(card, VAR.pad);
      await space(card, 'paddingTop', 40); await space(card, 'paddingBottom', 40);
      if (s.title) { const t = await T.txt(s.title, 'titleSM', 'elementPrimary', card); t.textAutoResize = 'HEIGHT'; fill(t, 'FILL'); }
      if (s.body) { const b = await T.txt(s.body, 'body', 'elementPrimary', card); b.textAutoResize = 'HEIGHT'; fill(b, 'FILL'); }
      for (const f of s.fields || []) {
        const name = f.kind === 'select' ? 'Select (native)' : f.kind === 'textarea' ? 'Multi-line' : 'Input: Default';
        let i = null;
        try { i = await T.instByName(name, card); } catch (e) { T.LOG.push('field: ' + e.message); continue; }
        setProps(i, { Label: f.label });
        if (f.value !== undefined) { const key = propKey(i, 'Input text') ? 'Input text' : 'Input'; setProps(i, { [key]: f.value, Filled: true }); }
        if (f.message) { setProps(i, { 'Inline message': true }); await write(i, /message/i, f.message); }
      }
      const row = T.fr('actions', 'HORIZONTAL', card); await space(row, 'itemSpacing', 16); row.counterAxisAlignItems = 'CENTER';
      // text buttons without icons (rule K1: icons only when commonly associated with the action)
      const btn = async (name, label) => { if (!label) return; try { const b = await T.instByName(name, row); setProps(b, { Label: label, 'Show leading icon': false, 'Show trailing icon': false }); } catch (e) { T.LOG.push('button: ' + e.message); } };
      await btn('Primary text button', s.primary); await btn('Secondary text button', s.secondary); await btn('Tertiary text button', s.tertiary);
    },
  };
}
