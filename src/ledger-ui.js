const icons = {
  brand: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10m-3-3 3 3-3 3m3 2H7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  chart: '<path d="M3 4v16h18M8 15v-4m5 4V7m5 8V5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="7"/>',
  exchange: '<path d="M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 16v4h16v-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3"/>',
  wallet: '<path d="M20 8V6a2 2 0 0 0-2-2l-12 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M4 8h14a2 2 0 0 1 2 2v2"/><path d="M22 12h-6a2 2 0 1 0 0 4h6z"/>',
  layer: '<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  receipt: '<path d="M5 4l2 1 2-1 3 1 3-1 2 1 2-1v16l-2-1-2 1-3-1-3 1-2-1-2 1zM9 9h6m-6 4h6"/>',
  pie: '<path d="M11 3a9 9 0 1 0 10 10h-10z"/><path d="M14 3v7h7a8 8 0 0 0-7-7z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  edit: '<path d="m14 6 4 4M5 19l4-.8L19 8l-3-3L6 15z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13m-6 3v6m2-6v6"/>'
};
const byId = id => document.getElementById(id);
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
const esc = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const flagImage = code => '<img class="currency-flag" src="' + currencyFlags[code] + '" alt="">';
const currencyTag = (code, label = code) =>
  '<span class="currency-tag' + (label === code ? ' currency-code' : '') + '" data-currency="' + code + '">' +
  flagImage(code) + '<span>' + esc(label) + '</span></span>';
const flaggedAmount = (amount, code, sign = '') => currencyTag(code, sign + money(amount, code));
const flaggedNumber = (amount, code) => currencyTag(code, number(amount, code));
const currencyText = text => String(text ?? '').split(/\b([A-Z]{3})\b/g)
  .map(part => isCurrency(part) ? currencyTag(part) : esc(part)).join('');
const captions = {
  overview: ['帳本總覽', '追蹤外幣餘額與每筆支出的實際成本。'],
  history: ['交易紀錄', '查閱每筆換匯與消費，按月份和幣別篩選。'],
  reports: ['支出統計', '按月份查看每天支出與消費類別。'],
  deleted: ['最近刪除', '復原誤刪的交易，帳本會重新計算成本與餘額。']
};
const deletedTime = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
const storageKey = 'study-abroad-ledger-v1';
const todayMonth = () => dateKey().slice(0, 7);
let personal = emptyBook();
let month = todayMonth();
let spendingCurrency = '';
let filters = { month: '', type: '', currency: '' };
let storageText = null;
let storageAllowed = true;
let storageCorrupt = false;
let transaction = null;
let confirmation = null;
let noticeTimer;

function notice(message, error = false) {
  window.clearTimeout(noticeTimer);
  const element = byId('notice');
  element.innerHTML = currencyText(message);
  element.classList.toggle('error', error);
  element.hidden = !message;
  if (message && !error) noticeTimer = window.setTimeout(() => { element.hidden = true; }, 4700);
}

function storageStatus() {
  byId('storage-label').textContent = storageCorrupt ? '本機帳本需要還原' :
    storageAllowed ? '資料儲存於此瀏覽器' : '僅暫存在此視窗';
}

function loadLocal(raw) {
  storageText = raw;
  try {
    personal = raw ? validateBook(JSON.parse(raw)) : emptyBook();
    storageCorrupt = false;
  } catch {
    storageCorrupt = true;
    notice('本機帳本無法讀取。可以從「帳本設定」匯入備份。', true);
  }
  storageStatus();
}

function saveBook(book, restore = false) {
  if (storageCorrupt && !restore) throw new Error('請先從「帳本設定」還原備份。');
  if (storageAllowed) {
    let current;
    try {
      current = localStorage.getItem(storageKey);
    } catch {
      storageAllowed = false;
    }
    if (storageAllowed && current !== storageText) {
      loadLocal(current);
      render();
      throw new Error('另一個分頁已更新帳本，請關閉視窗後重新操作。');
    }
    if (storageAllowed) {
      const raw = JSON.stringify(book);
      try {
        localStorage.setItem(storageKey, raw);
        storageText = raw;
      } catch {
        storageAllowed = false;
      }
    }
  }
  personal = book;
  storageCorrupt = false;
  storageStatus();
}

const currentPage = () => {
  const hash = location.hash.slice(1);
  return has(captions, hash) ? hash : 'overview';
};
const monthText = key => key.slice(0, 4) + ' 年 ' + Number(key.slice(5)) + ' 月';
const option = (value, label, selected) =>
  '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
const supportsCurrencyFlags = CSS.supports('appearance', 'base-select') && CSS.supports('selector(::picker(select))');
const currencyChoice = (code, label = code + ' · ' + currencies[code][0]) => ({ value: code, code, label });
const currencyChoices = codes => codes.map(code => currencyChoice(code));

function currencyOptions(choices, selected) {
  const trigger = supportsCurrencyFlags ? '<button type="button"><selectedcontent></selectedcontent></button>' : '';
  return trigger + choices.map(({ value, code, label }) => {
    if (!supportsCurrencyFlags || !code) return option(value, label, selected);
    return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' +
      flagImage(code) + '<span>' + esc(label) + '</span></option>';
  }).join('');
}

function currencySelect(attributes, choices, selected) {
  return '<select ' + attributes + (supportsCurrencyFlags ? ' class="flag-select"' : '') + '>' +
    currencyOptions(choices, selected) + '</select>';
}

function monthOptions(book, selected, all = false) {
  const reference = new Date();
  reference.setDate(1);
  const keys = new Set(book.entries.filter(isActive).map(row => row.date.slice(0, 7)));
  for (let index = 0; index < 12; index++) {
    keys.add(dateKey(reference).slice(0, 7));
    reference.setMonth(reference.getMonth() - 1);
  }
  if (selected) keys.add(selected);
  return (all ? option('', '全部月份', selected) : '') +
    [...keys].sort().reverse().map(key => option(key, monthText(key), selected)).join('');
}

const sectionHeading = (title, subtitle = '', action = '') =>
  '<div class="panel-heading"><div><h2>' + title + '</h2>' + (subtitle ? '<p>' + subtitle + '</p>' : '') +
  '</div>' + action + '</div>';
const empty = (symbol, title, description = '', action = '') =>
  '<div class="empty"><span class="empty-icon">' + icon(symbol) + '</span><strong>' + title + '</strong>' +
  (description ? '<p>' + description + '</p>' : '') + action + '</div>';
const textAction = (name, label) => '<button type="button" class="text-button" data-action="' + name + '">' + label + '</button>';
const rightLink = (page, label) => '<a class="text-button" href="#' + page + '">' + label + icon('arrow') + '</a>';
function spendingControls(book, wallets) {
  const choices = [{ value: '', code: book.base, label: '全部支出 · ' + book.base },
    ...[...wallets.keys()].sort().map(code => currencyChoice(code, code + ' 原幣支出'))];
  return '<div class="spending-controls">' +
    currencySelect('id="report-currency" aria-label="支出顯示幣別"', choices, spendingCurrency) +
    '<select id="report-month" aria-label="統計月份">' + monthOptions(book, month) + '</select></div>';
}

function expenseStats(rows, base) {
  const monthly = rows.filter(row => row.type === 'expense' && row.date.startsWith(month) &&
    (!spendingCurrency || row.currency === spendingCurrency));
  const byCategory = new Map();
  const byDay = new Map();
  let total = 0n;
  for (const row of monthly) {
    const amount = spendingCurrency ? BigInt(row.amount) : row.cost;
    total += amount;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0n) + amount);
    byDay.set(row.date, (byDay.get(row.date) ?? 0n) + amount);
  }
  return { currency: spendingCurrency || base, total, count: monthly.length, byCategory, byDay };
}

const noSpending = currency => spendingCurrency ? '這個月還沒有 ' + currencyTag(currency) + ' 消費' : '這個月還沒有消費';

function distribution(stats) {
  if (!stats.count) return empty('pie', noSpending(stats.currency));
  const sorted = [...stats.byCategory].sort((a, b) => a[1] === b[1] ? 0 : a[1] < b[1] ? 1 : -1);
  let accumulated = 0n;
  const stops = sorted.map(([key, amount]) => {
    const start = percent(accumulated, stats.total);
    accumulated += amount;
    return categories[key][1] + ' ' + start + '% ' + percent(accumulated, stats.total) + '%';
  });
  const background = stats.total ? 'conic-gradient(' + stops.join(',') +
    (stops.length === 1 ? ',' + stops[0] : '') + ')' : '#efebf8';
  const legend = sorted.map(([key, amount]) => '<div class="legend-row"><span><i style="background:' +
    categories[key][1] + '"></i>' + categories[key][0] + '</span><strong>' + flaggedNumber(amount, stats.currency) +
    ' <small>' + percent(amount, stats.total) + '%</small></strong></div>').join('');
  return '<div class="distribution"><div class="donut" style="background:' + background +
    '"><span><strong>' + sorted.length + '</strong>個類別</span></div><div class="legend">' + legend + '</div></div>';
}

function walletsList(wallets, base) {
  if (!wallets.size) return empty('wallet', '還沒有外幣帳戶', '新增第一筆換匯，就會建立對應的外幣帳戶。',
    textAction('exchange', '新增第一筆換匯'));
  return '<div class="wallet-list">' + [...wallets].map(([code, wallet]) => {
    const [name, symbol, , tone] = currencies[code];
    const costs = [['手續費前', wallet.beforeFees], ['手續費後', wallet.withFees]].map(([label, basis]) => {
      const average = averageCostAmount(wallet, code, base, basis);
      const rate = average === null ? '—' : currencyTag(base) + ' ' + average + ' / ' + currencyTag(code);
      return '<div class="wallet-basis"><h3>' + label + '</h3><dl><dt>平均成本匯率</dt><dd>' +
        rate + '</dd><dt>剩餘成本</dt><dd>' + flaggedAmount(balanceCost(wallet, basis), base) + '</dd></dl></div>';
    }).join('');
    return '<article class="wallet-item"><div class="wallet-name"><span class="wallet-icon ' + tone +
      (symbol.length > 2 ? ' long' : '') + '">' + symbol + '</span><div><strong>' + name + '</strong><small>' +
      currencyTag(code) + '</small></div></div><div class="wallet-value"><strong>' + flaggedNumber(wallet.units, code) +
      '</strong></div><div class="wallet-costs">' + costs + '</div></article>';
  }).join('') + '</div>';
}

function transactionContent(row) {
  const exchange = row.type === 'exchange';
  const label = exchange ? '換匯入帳' : categories[row.category][0] + '消費';
  return '<div class="row-name"><span class="row-icon' + (exchange ? ' tone-green' : '') + '">' +
    icon(exchange ? 'exchange' : 'receipt') + '</span><div><strong>' + label + '</strong>' +
    (row.note ? '<small>' + esc(row.note) + '</small>' : '') +
    transactionLocation(row) + '</div></div>';
}

function transactionTable(rows, base, actions = false) {
  const heads = '<th scope="col">日期</th><th scope="col">交易內容</th><th scope="col" class="amount-cell">外幣變動</th>' +
    '<th scope="col" class="amount-cell">成本（' + currencyTag(base) + '）</th>' +
    (actions ? '<th scope="col" class="amount-cell">操作</th>' : '');
  const body = rows.map((row, index) => {
    const exchange = row.type === 'exchange';
    const details = exchange && actions ? '<small>本金 ' + flaggedAmount(BigInt(row.principal), row.principalCurrency) +
      '</small><small>手續費 ' + flaggedAmount(BigInt(row.fee), row.feeCurrency) + '</small>' +
      Object.entries(row.rates).map(([currency, rate]) => '<small>1 ' + currencyTag(currency) + ' = ' +
        rateText(rate) + ' ' + currencyTag(base) + '</small>').join('') : '';
    const detailId = 'transaction-cost-detail-' + index;
    const kind = exchange ? '換匯' : '消費';
    const toggle = '<button class="text-button cost-toggle" type="button" data-cost-toggle="' + kind +
      '" aria-label="展開' + kind + '成本明細" aria-expanded="false" aria-controls="' + detailId + '">' +
      '<span>明細</span>' + icon('down') + '</button>';
    const actionsCell = actions ? '<td class="table-actions"><button class="icon-button" type="button" aria-label="編輯交易" data-edit="' +
      esc(row.id) + '">' + icon('edit') + '</button><button class="icon-button delete" type="button" aria-label="刪除交易" data-delete="' +
      esc(row.id) + '">' + icon('trash') + '</button></td>' : '';
    return '<tr class="transaction-row"><td><time datetime="' + row.date + '">' + row.date + '</time></td><td>' + transactionContent(row) +
      '</td><td class="amount-cell"><strong class="' + (exchange ? 'incoming' : '') + '">' +
      flaggedAmount(BigInt(row.amount), row.currency, exchange ? '+' : '−') +
      '</strong>' + (actions ? '<small>交易後 ' + flaggedAmount(row.balance, row.currency) + '</small>' : '') +
      '</td><td class="amount-cell"><strong>' + flaggedNumber(row.cost, base) + '</strong>' + details + toggle + '</td>' +
      actionsCell + '</tr>' + transactionCostDetail(row, base, detailId, actions ? 5 : 4);
  }).join('');
  return '<div class="table-wrap' + (actions ? '' : ' compact-table') + '" tabindex="0" aria-label="交易表格"><table><thead><tr>' + heads +
    '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

function transactionCostDetail(row, base, id, columns) {
  return '<tr id="' + id + '" class="cost-detail-row" hidden><td colspan="' + columns + '"><dl class="transaction-costs">' +
    '<div><dt>手續費前成本</dt><dd>' + flaggedAmount(row.costBeforeFees, base) + '</dd></div>' +
    '<div><dt>手續費後成本</dt><dd>' + flaggedAmount(row.cost, base) + '</dd></div>' +
    '</dl></td></tr>';
}

function transactionLocation(row) {
  const label = row.place || (row.coordinates ? '待補地點名稱' : '');
  if (!label) return '';
  return '<small class="record-location">' + icon('pin') + '<span>' + esc(label) + '</span></small>';
}

function hero(book, stats, wallets) {
  const note = spendingCurrency ? '按 ' + currencyTag(spendingCurrency) + ' 實際支付金額統計' :
    '全部消費依外幣取得成本計算，含分攤的換匯手續費';
  return '<section class="hero"><div class="hero-art" aria-hidden="true"><span class="orbit"></span>' +
    '<span class="coin coin-eur">€</span><span class="coin coin-usd">$</span><span class="coin coin-jpy">¥</span></div>' +
    '<p class="scope">' + icon('calendar') + (month === todayMonth() ? '本月支出' : '當月支出') + '</p>' +
    '<p class="hero-amount">' + number(stats.total, stats.currency) + '<small>' + currencyTag(stats.currency) + '</small></p>' +
    '<p class="hero-note">' + note + '</p>' + spendingControls(book, wallets) + '</section>';
}

function metric(symbol, tone, label, value, unit) {
  return '<div class="metric"><span class="metric-icon ' + tone + '">' + icon(symbol) + '</span><div>' +
    '<span class="metric-label">' + label + '</span><div class="metric-value">' + value +
    '<small>' + unit + '</small></div></div></div>';
}

function overview(book, data, stats) {
  const totalHolding = [...data.wallets.values()].reduce((total, wallet) => total + balanceCost(wallet), 0n);
  const latest = data.rows.slice(-5).reverse();
  return hero(book, stats, data.wallets) + '<div class="metrics">' +
    metric('wallet', '', '外幣持有成本（含手續費）', number(totalHolding, book.base), currencyTag(book.base)) +
    metric('layer', 'tone-green', '外幣帳戶', data.wallets.size, '個') +
    metric('receipt', 'tone-blue', month === todayMonth() ? '本月消費筆數' : '當月消費筆數', stats.count, '筆') +
    '</div><div class="overview-grid"><section class="panel">' +
    sectionHeading('外幣帳戶', '依換匯本金與另付手續費計算移動加權平均成本') + walletsList(data.wallets, book.base) +
    '</section><section class="panel">' +
    sectionHeading('支出分布', monthText(month) + ' · ' + currencyTag(stats.currency), rightLink('reports', '支出統計')) +
    distribution(stats) + '</section></div><section class="panel">' +
    sectionHeading('近期交易', '', rightLink('history', '全部交易')) +
    (latest.length ? transactionTable(latest, book.base) : empty('list', '還沒有交易紀錄', '換匯和消費會依日期列在這裡。')) +
    '</section>';
}

function filterField(label, control) {
  return '<label class="filter"><span>' + label + '</span>' + control + '</label>';
}

function history(book, data) {
  const codeOptions = [...data.wallets.keys()].sort();
  if (filters.currency && !codeOptions.includes(filters.currency)) filters.currency = '';
  const filtered = data.rows.filter(row => (!filters.month || row.date.startsWith(filters.month)) &&
    (!filters.currency || row.currency === filters.currency) && (!filters.type || row.type === filters.type)).reverse();
  return '<section class="panel"><div class="toolbar"><div class="filters">' +
    filterField('月份', '<select id="filter-month">' + monthOptions(book, filters.month, true) + '</select>') +
    filterField('類型', '<select id="filter-type">' + option('', '全部交易', filters.type) +
      option('exchange', '換匯', filters.type) + option('expense', '消費', filters.type) + '</select>') +
    filterField('外幣帳戶', currencySelect('id="filter-currency"',
      [{ value: '', label: '全部幣別' }, ...currencyChoices(codeOptions)], filters.currency)) +
    '</div><div class="toolbar-links"><p class="count-label">共 ' + filtered.length + ' 筆交易</p>' +
    rightLink('deleted', '最近刪除') + '</div></div>' +
    (filtered.length ? transactionTable(filtered, book.base, true) : empty('list', '沒有符合條件的交易',
      data.rows.length ? '試著調整月份、類型或外幣帳戶。' : '新增換匯或消費後，交易會出現在這裡。')) + '</section>';
}

function deletedTransactions(book) {
  const rows = book.entries.filter(row => !isActive(row)).reverse()
    .sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  const heading = '<div class="toolbar trash-toolbar"><p class="count-label">共 ' + rows.length + ' 筆</p>' +
    rightLink('history', '回到交易紀錄') + '</div>';
  if (!rows.length) {
    return '<section class="panel">' + heading +
      empty('trash', '最近沒有刪除的交易', '刪除的交易會出現在這裡，可以復原。') + '</section>';
  }
  const body = rows.map(row => {
    const time = '<time datetime="' + row.deletedAt + '">' + deletedTime.format(new Date(row.deletedAt)) + '</time>';
    return '<tr><td><time datetime="' + row.date + '">' + row.date + '</time></td><td>' + transactionContent(row) +
      '<small class="deleted-time-mobile">刪除於 ' + time + '</small></td><td class="amount-cell"><strong>' +
      flaggedAmount(BigInt(row.amount), row.currency) + '</strong></td><td class="deleted-time-column">' + time +
      '</td><td class="table-actions"><button class="button secondary restore-button" type="button" data-restore="' +
      esc(row.id) + '">復原</button></td></tr>';
  }).join('');
  return '<section class="panel">' + heading + '<div class="table-wrap deleted-table" tabindex="0" aria-label="最近刪除記錄">' +
    '<table><thead><tr><th scope="col">交易日期</th><th scope="col">交易內容</th>' +
    '<th scope="col" class="amount-cell">外幣金額</th><th scope="col" class="deleted-time-column">刪除時間</th>' +
    '<th scope="col" class="amount-cell">操作</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
}

function reports(book, data, stats) {
  const maximum = [...stats.byDay.values()].reduce((max, amount) => amount > max ? amount : max, 0n);
  const daily = [...stats.byDay].map(([date, cost]) => '<div class="day"><time datetime="' + date + '">' +
    Number(date.slice(5, 7)) + '/' + Number(date.slice(8)) + '</time><div class="bar-track" aria-hidden="true">' +
    '<span style="width:' + percent(cost, maximum) + '%"></span></div><strong>' + flaggedNumber(cost, stats.currency) + '</strong></div>').join('');
  return hero(book, stats, data.wallets) + '<div class="metrics">' +
    metric('receipt', '', '消費筆數', stats.count, '筆') +
    metric('pie', 'tone-green', '消費類別', stats.byCategory.size, '個') +
    metric('calendar', 'tone-blue', '有消費的日數', stats.byDay.size, '天') +
    '</div><div class="report-grid"><section class="panel">' + sectionHeading('每日支出', currencyTag(stats.currency)) +
    (daily ? '<div class="daily-chart">' + daily + '</div>' : empty('calendar', noSpending(stats.currency))) + '</section>' +
    '<section class="panel">' + sectionHeading('類別分布', currencyTag(stats.currency)) + distribution(stats) + '</section></div>';
}

function render() {
  const page = currentPage();
  const book = personal;
  const data = calculate(book);
  if (spendingCurrency && !data.wallets.has(spendingCurrency)) spendingCurrency = '';
  const stats = expenseStats(data.rows, book.base);
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  byId('page-title').textContent = captions[page][0];
  byId('page-caption').textContent = captions[page][1];
  byId('page-actions').hidden = page === 'deleted';
  byId('view').innerHTML = page === 'overview' ? overview(book, data, stats) :
    page === 'history' ? history(book, data) : page === 'reports' ? reports(book, data, stats) : deletedTransactions(book);
}

const formField = (label, input, help = '', full = false) =>
  '<label class="field' + (full ? ' full' : '') + '"><span>' + label + '</span>' + input +
  (help ? '<small>' + help + '</small>' : '') + '</label>';
const textInput = (name, value, placeholder = '', numeric = true, maxLength = numeric ? 15 : 100) => '<input name="' + name +
  '" value="' + esc(value) + '" placeholder="' + esc(placeholder) +
  '" autocomplete="off" type="text" maxlength="' + maxLength + '"' + (numeric ? ' inputmode="decimal"' : '') + '>';
const transactionCurrencySelect = (name, codes, selected) =>
  currencySelect('name="' + name + '"', currencyChoices(codes), selected);

function transactionLocationField(kind, previous) {
  return '<div class="location-field"><div class="location-entry">' +
    formField(kind + '地點（選填）', textInput('place', previous?.place ?? '', '手動輸入地點名稱或地址', false, maxPlaceLength)) +
    '<button type="button" class="button secondary location-button" id="locate-transaction">' +
    icon('pin') + '使用目前位置</button></div>' +
    (previous?.coordinates && !previous.place ?
      '<button type="button" class="text-button location-existing" id="locate-existing">用原定位查名稱</button>' : '') +
    '<p class="location-help">查詢需連線，會將定位傳給 Photon。 ' +
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></p>' +
    '<p class="location-feedback" id="location-feedback" role="status" hidden></p></div>';
}

function openTransaction(type, previous) {
  const book = personal;
  const exchanges = new Set(book.entries.filter(row => row.type === 'exchange' && isActive(row)).map(row => row.currency));
  if (type === 'expense' && !exchanges.size) {
    notice('請先新增換匯，建立可以記帳的外幣帳戶。', true);
    byId('new-exchange').focus();
    return;
  }
  if (storageCorrupt) {
    notice('請先從「帳本設定」還原備份。', true);
    return;
  }
  const choices = type === 'exchange' ? Object.keys(currencies).filter(code => code !== book.base) : [...exchanges];
  const currency = previous?.currency ?? (choices.includes('EUR') ? 'EUR' : choices[0]);
  const exchange = type === 'exchange';
  const base = book.base;
  const rateValues = Object.fromEntries(Object.entries(previous?.rates ?? {}).map(([code, rate]) =>
    ['rate-' + code, rateText(rate)]));
  transaction = { type, previous, book, rateValues, id: previous?.id ?? (
    typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-')
  ) };
  byId('transaction-title').textContent = (previous ? '編輯' : '新增') + (exchange ? '換匯' : '消費');
  byId('transaction-caption').innerHTML = exchange ? '本金與另付手續費會折算為基準貨幣（' + currencyTag(base) + '）。' :
    '消費成本依交易當日的帳本平均成本分攤。';
  const fields = [
    formField('交易日期', '<input type="date" name="date" value="' + (previous?.date ?? dateKey()) + '">'),
    formField(exchange ? '取得幣別' : '外幣帳戶', transactionCurrencySelect('currency', choices, currency)),
    formField(exchange ? '實收外幣金額' : '消費外幣金額', textInput('amount',
      previous ? inputAmount(previous.amount, currency) : '', exchange ? '例如 200' : '例如 50'), '', exchange)
  ];
  if (exchange) {
    const allCurrencies = Object.keys(currencies);
    const principalCurrency = previous?.principalCurrency ?? base;
    const feeCurrency = previous?.feeCurrency ?? base;
    fields.push(
      formField('本金幣別', transactionCurrencySelect('principalCurrency', allCurrencies, principalCurrency)),
      formField('換匯本金', textInput('principal', previous ? inputAmount(previous.principal, principalCurrency) : '', '例如 1600')),
      formField('手續費幣別', transactionCurrencySelect('feeCurrency', allCurrencies, feeCurrency)),
      formField('另付手續費', textInput('fee', previous ? inputAmount(previous.fee, feeCurrency) : '', '0')),
      '<div class="form-grid exchange-rates" id="exchange-rates" hidden></div>'
    );
  } else {
    fields.push(formField('消費類別', '<select name="category">' + Object.keys(categories).map(key =>
      option(key, categories[key][0], previous?.category ?? 'food')).join('') + '</select>'));
  }
  fields.push(
    transactionLocationField(exchange ? '換匯' : '消費', previous),
    formField('備註（選填）', textInput('note', previous?.note ?? '', exchange ? '例如 首次換匯' : '例如 午餐', false), '', true)
  );
  byId('transaction-fields').innerHTML = fields.join('');
  byId('transaction-error').hidden = true;
  if (exchange) updateRateFields();
  byId('locate-transaction').addEventListener('click', () => locateTransaction());
  byId('locate-existing')?.addEventListener('click', () => locateTransaction(previous.coordinates));
  updatePreview();
  byId('transaction-dialog').showModal();
}

function renderLocationStatus(message, error = false) {
  const busy = Boolean(transaction.locationRequest);
  byId('locate-transaction').disabled = busy;
  const existing = byId('locate-existing');
  if (existing) existing.disabled = busy;
  const feedback = byId('location-feedback');
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.classList.toggle('error', error);
}

function devicePosition() {
  const unavailable = '目前無法取得位置，可以手動輸入店名或地址。';
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(unavailable));
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (validCoordinates(coords)) resolve(coords);
      else reject(new Error(unavailable));
    }, error => {
      const messages = {
        1: '瀏覽器未允許定位，可以手動輸入店名或地址。',
        3: '定位逾時，可以重試或手動輸入店名或地址。'
      };
      reject(new Error(messages[error.code] ?? unavailable));
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  });
}

async function nearbyPlace(point, controller) {
  const url = new URL('https://photon.komoot.io/reverse');
  url.search = new URLSearchParams({
    lat: point.latitude.toFixed(5), lon: point.longitude.toFixed(5), radius: '0.15', limit: '3', lang: 'default',
    layer: 'house'
  });
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store'
    });
    if (!response.ok) throw new Error('Place lookup failed');
    const result = await response.json();
    const features = Array.isArray(result?.features) ? result.features : [];
    for (const feature of features) {
      const properties = feature?.properties;
      if (!properties || (properties.type && properties.type !== 'house')) continue;
      const text = key => typeof properties[key] === 'string' ? properties[key].trim() : '';
      const street = text('street');
      const house = text('housenumber');
      const name = text('name') || (street && house ? [text('city'), street, house].filter(Boolean).join(' ') : '');
      if (name) return name.slice(0, maxPlaceLength);
    }
    return '';
  } finally {
    window.clearTimeout(timer);
  }
}

async function locateTransaction(savedPoint) {
  const draft = transaction;
  const dialog = byId('transaction-dialog');
  const place = byId('transaction-form').elements.place;
  const inputBeforeLookup = place.value;
  const request = new AbortController();
  draft.locationRequest = request;
  const stillEditing = () => transaction === draft && dialog.open && draft.locationRequest === request;
  let message;
  let error = false;
  try {
    if (!savedPoint) renderLocationStatus('正在取得目前位置…');
    const point = savedPoint ?? await devicePosition();
    if (!stillEditing()) return;
    renderLocationStatus('正在查詢附近地點名稱…');
    let name;
    try {
      name = await nearbyPlace(point, request);
    } catch {
      throw new Error('目前無法查詢地點名稱，可以手動輸入店名或地址。');
    }
    if (!stillEditing()) return;
    if (!name) throw new Error('找不到附近的地點名稱，可以手動輸入店名或地址。');
    if (place.value === inputBeforeLookup) {
      place.value = name;
      message = '已填入附近地點，請確認店名或地址。';
    } else {
      message = '查到附近地點「' + name + '」。';
    }
  } catch (failure) {
    error = true;
    message = failure.message;
  } finally {
    if (stillEditing()) {
      draft.locationRequest = undefined;
      renderLocationStatus(message, error);
    }
  }
}

function updateRateFields() {
  if (transaction.type !== 'exchange') return;
  const { base } = transaction.book;
  const fields = byId('transaction-form').elements;
  const hasFee = /[1-9]/.test(fields.fee.value);
  const required = paymentRateCurrencies(fields.principalCurrency.value, fields.feeCurrency.value, hasFee, base);
  const block = byId('exchange-rates');
  const key = required.join(',');
  if (block.dataset.currencies === key) return;
  for (const input of block.querySelectorAll('input')) {
    transaction.rateValues[input.name] = input.value;
  }
  block.dataset.currencies = key;
  block.hidden = !required.length;
  block.innerHTML = required.map(currency => {
    const name = 'rate-' + currency;
    return formField('1 ' + currencyTag(currency) + ' 折合多少 ' + currencyTag(base),
      textInput(name, transaction.rateValues[name] ?? '', '輸入這筆交易的匯率', true, 25));
  }).join('');
}

function draftBook() {
  const { book, previous, type, id } = transaction;
  const fields = new FormData(byId('transaction-form'));
  const date = fields.get('date');
  const currency = fields.get('currency');
  if (!validDate(date)) throw new Error('請輸入有效的交易日期。');
  const amount = readAmount(fields.get('amount'), currency, '外幣金額');
  const row = { id, type, date, currency, amount, note: fields.get('note').trim() };
  if (type === 'exchange') {
    row.principalCurrency = fields.get('principalCurrency');
    row.feeCurrency = fields.get('feeCurrency');
    row.principal = readAmount(fields.get('principal'), row.principalCurrency, '換匯本金');
    row.fee = readAmount(fields.get('fee').trim() || '0', row.feeCurrency, '手續費', true);
    const required = paymentRateCurrencies(row.principalCurrency, row.feeCurrency, BigInt(row.fee) > 0n, book.base);
    row.rates = Object.fromEntries(required.map(code => [code, readRate(fields.get('rate-' + code), code, book.base)]));
  } else {
    row.category = fields.get('category');
  }
  const place = fields.get('place').trim();
  if (place) row.place = place;
  else if (previous?.coordinates && !previous.place) row.coordinates = previous.coordinates;
  const entries = previous ? book.entries.map(entry => entry.id === id ? row : entry) : [...book.entries, row];
  return { ...book, entries };
}

function updatePreview() {
  const element = byId('transaction-preview');
  element.hidden = true;
  try {
    const book = draftBook();
    const row = calculate(book).rows.find(entry => entry.id === transaction.id);
    const label = row.type === 'exchange' ? '本次換匯總成本' : '本筆消費成本';
    element.innerHTML = label + '　' + flaggedAmount(row.cost, book.base) + '　｜　交易後餘額 ' +
      flaggedAmount(row.balance, row.currency);
    element.hidden = false;
  } catch {
    // Incomplete inputs are expected while typing. Submit displays actionable validation errors.
  }
}

function saveTransaction(event) {
  event.preventDefault();
  const errorBox = byId('transaction-error');
  try {
    if (transaction.book !== personal) throw new Error('帳本已更新，請關閉視窗後重新編輯。');
    const book = draftBook();
    calculate(book);
    saveBook(book);
    const label = transaction.previous ? '已更新交易。' : transaction.type === 'exchange' ? '已新增換匯。' : '已新增消費。';
    byId('transaction-dialog').close();
    render();
    savedNotice(label);
  } catch (error) {
    errorBox.innerHTML = currencyText(error.message);
    errorBox.hidden = false;
  }
}

function savedNotice(message) {
  notice(storageAllowed ? message : message + ' 瀏覽器目前無法儲存，請在關閉前匯出備份。', !storageAllowed);
}

function askToConfirm(title, caption, actionLabel, action) {
  byId('confirm-title').textContent = title;
  byId('confirm-caption').innerHTML = currencyText(caption);
  byId('confirm-action').textContent = actionLabel;
  confirmation = action;
  byId('confirm-dialog').showModal();
}

function deleteTransaction(id) {
  const book = personal;
  const row = book.entries.find(entry => entry.id === id && isActive(entry));
  if (!row) return;
  const type = row.type === 'exchange' ? '換匯' : '消費';
  askToConfirm('刪除這筆' + type + '？', row.date + ' 的 ' + money(BigInt(row.amount), row.currency) +
    ' ' + type + '將移至「最近刪除」，可以復原。後續交易會重新計算。', '移至最近刪除', () => {
    if (book !== personal) throw new Error('帳本已更新，請重新確認交易後再刪除。');
    const deletedAt = new Date().toISOString();
    const updated = { ...book, entries: book.entries.map(entry => entry === row ? { ...entry, deletedAt } : entry) };
    calculate(updated);
    saveBook(updated);
    render();
    savedNotice('已移至「最近刪除」，可以從那裡復原。');
  });
}

function restoreTransaction(id) {
  const book = personal;
  const row = book.entries.find(entry => entry.id === id && !isActive(entry));
  if (!row) return;
  const restored = { ...row };
  delete restored.deletedAt;
  // Keep the original position so same-day transactions use their original recording order.
  const updated = { ...book, entries: book.entries.map(entry => entry === row ? restored : entry) };
  try {
    calculate(updated);
    saveBook(updated);
    render();
    const view = byId('view');
    (view.querySelector('[data-restore]') ?? view.querySelector('a'))?.focus();
    savedNotice('已復原交易，餘額與成本已重新計算。');
  } catch (error) {
    notice('無法復原這筆交易。' + error.message, true);
  }
}

function updateSettings() {
  const select = byId('base-currency');
  select.classList.toggle('flag-select', supportsCurrencyFlags);
  select.innerHTML = currencyOptions(currencyChoices(Object.keys(currencies)), personal.base);
  select.disabled = personal.entries.length > 0 || storageCorrupt;
  byId('base-help').textContent = storageCorrupt ? '請先匯入個人帳本備份。' :
    personal.entries.some(isActive) ? '帳本已有交易，基準貨幣已固定。' :
      personal.entries.length ? '仍有可復原的交易，基準貨幣已固定。' : '用來計算換匯成本與統計支出。';
}

function settingsError(message) {
  const element = byId('settings-error');
  element.hidden = !message;
  element.innerHTML = currencyText(message);
}

function exportData() {
  if (storageCorrupt) {
    settingsError('本機帳本無法讀取。請匯入可用的備份。');
    return;
  }
  const blob = new Blob([JSON.stringify(personal, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'study-ledger-backup-' + dateKey() + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function importData(event) {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  settingsError('');
  try {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('無法讀取這個 JSON 檔。');
    }
    const restored = validateBook(parsed);
    const activeEntries = restored.entries.filter(isActive);
    const deletedCount = restored.entries.length - activeEntries.length;
    const summary = activeEntries.length + ' 筆交易' + (deletedCount ? '及 ' + deletedCount + ' 筆最近刪除的交易' : '');
    const source = personal;
    const apply = () => {
      if (source !== personal) throw new Error('帳本已更新，請重新匯入備份。');
      saveBook(restored, true);
      month = activeEntries.reduce((latest, row) =>
        row.date.slice(0, 7) > latest ? row.date.slice(0, 7) : latest, '') || todayMonth();
      spendingCurrency = '';
      filters = { month: '', type: '', currency: '' };
      updateSettings();
      render();
      byId('settings-dialog').close();
      notice('已匯入 ' + summary + '。' +
        (storageAllowed ? '' : ' 目前的瀏覽器僅能暫存帳本。'), !storageAllowed);
    };
    if (personal.entries.length || storageCorrupt) {
      askToConfirm('用備份取代我的帳本？', '備份含有 ' + summary +
        '。匯入後會取代目前帳本的全部資料。', '取代並匯入', apply);
    } else {
      apply();
    }
  } catch (error) {
    settingsError(error.message);
  }
}

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = icon(element.dataset.icon);
}
for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}
try {
  loadLocal(localStorage.getItem(storageKey));
} catch {
  storageAllowed = false;
  storageStatus();
}

byId('new-exchange').addEventListener('click', () => openTransaction('exchange'));
byId('new-expense').addEventListener('click', () => openTransaction('expense'));
byId('transaction-dialog').addEventListener('close', event => {
  if (!event.currentTarget.open) transaction?.locationRequest?.abort();
});
byId('transaction-form').addEventListener('submit', saveTransaction);
byId('transaction-form').addEventListener('input', () => {
  byId('transaction-error').hidden = true;
  updateRateFields();
  updatePreview();
});
byId('view').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'exchange') openTransaction('exchange');
  if (button.dataset.edit) {
    const row = personal.entries.find(entry => entry.id === button.dataset.edit && isActive(entry));
    if (row) openTransaction(row.type, row);
  }
  if (button.dataset.delete) deleteTransaction(button.dataset.delete);
  if (button.dataset.restore) restoreTransaction(button.dataset.restore);
  if (button.hasAttribute('data-cost-toggle')) {
    const detail = byId(button.getAttribute('aria-controls'));
    const expanded = detail.hidden;
    detail.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', (expanded ? '收合' : '展開') + button.dataset.costToggle + '成本明細');
    button.querySelector('span').textContent = expanded ? '收合' : '明細';
  }
});
byId('view').addEventListener('change', event => {
  const select = event.target;
  if (select.id === 'report-month') month = select.value;
  else if (select.id === 'report-currency') spendingCurrency = select.value;
  else if (select.id.startsWith('filter-')) filters[select.id.slice(7)] = select.value;
  else return;
  render();
  byId(select.id)?.focus();
});
byId('open-settings').addEventListener('click', () => {
  updateSettings();
  settingsError('');
  byId('settings-dialog').showModal();
});
byId('base-currency').addEventListener('change', event => {
  settingsError('');
  try {
    if (personal.entries.length) throw new Error('帳本已有交易，基準貨幣已固定。');
    saveBook(emptyBook(event.target.value));
    render();
    if (!storageAllowed) settingsError('瀏覽器目前無法儲存，請在關閉前匯出備份。');
  } catch (error) {
    updateSettings();
    settingsError(error.message);
  }
});
byId('export-data').addEventListener('click', exportData);
byId('import-data').addEventListener('click', () => byId('backup-file').click());
byId('backup-file').addEventListener('change', importData);
byId('confirm-action').addEventListener('click', () => {
  byId('confirm-dialog').close();
  try {
    confirmation?.();
  } catch (error) {
    if (byId('settings-dialog').open) settingsError(error.message);
    else notice(error.message, true);
  }
});
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
window.addEventListener('storage', event => {
  if (storageAllowed && (event.key === storageKey || event.key === null)) {
    loadLocal(event.newValue);
    if (byId('settings-dialog').open) updateSettings();
    render();
  }
});
render();
