const currencies = {
  CNY: ['人民幣', '¥', 2, 'rose'], EUR: ['歐元', '€', 2, 'violet'],
  USD: ['美元', '$', 2, 'green'], JPY: ['日圓', '¥', 0, 'rose'],
  TWD: ['新臺幣', 'NT$', 2, 'green'], GBP: ['英鎊', '£', 2, 'violet'],
  HKD: ['港幣', 'HK$', 2, 'rose'], CAD: ['加幣', 'C$', 2, 'rose'],
  AUD: ['澳幣', 'A$', 2, 'green'], SGD: ['新加坡幣', 'S$', 2, 'green'],
  KRW: ['韓元', '₩', 0, 'violet'], CHF: ['瑞士法郎', 'CHF', 2, 'rose'],
  NZD: ['紐西蘭幣', 'NZ$', 2, 'green'], INR: ['印度盧比', '₹', 2, 'violet'],
  MYR: ['馬來西亞令吉', 'RM', 2, 'green'], THB: ['泰銖', '฿', 2, 'violet'],
  VND: ['越南盾', '₫', 0, 'rose'], PHP: ['菲律賓披索', '₱', 2, 'violet']
};
const categories = {
  food: ['餐飲', '#7658ed'], transit: ['交通', '#27aa93'], housing: ['住宿', '#edaa51'],
  tuition: ['學習', '#5099ef'], shopping: ['購物', '#e87db1'], leisure: ['娛樂', '#9b72d5'],
  health: ['醫療', '#ee797c'], other: ['其他', '#7b8ba9']
};
const has = (object, key) => Object.hasOwn(object, key);
const isCurrency = code => typeof code === 'string' && has(currencies, code);
const group = new Intl.NumberFormat('zh-TW');
const scale = currency => 10n ** BigInt(currencies[currency][2]);
const ratePlaces = 12;
const rateScale = 10n ** BigInt(ratePlaces);
const bookVersion = 3;
const maxPlaceLength = 120;
const emptyBook = (base = 'CNY') => ({ version: bookVersion, base, entries: [] });
const isActive = row => row.deletedAt === undefined;

function validCoordinates(point) {
  return point && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
    (point.accuracy === undefined || (Number.isFinite(point.accuracy) && point.accuracy >= 0));
}

function dateKey(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return Number.isFinite(date.getTime()) && dateKey(date) === value && value.slice(0, 4) !== '0000';
}

function scaledDecimal(value, places) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * (10n ** BigInt(places)) + BigInt(fraction.padEnd(places, '0') || '0');
}

function readAmount(value, currency, label, allowZero = false) {
  const clean = value.trim();
  const places = currencies[currency][2];
  const pattern = places ? /^\d{1,12}(?:\.\d{1,2})?$/ : /^\d{1,12}$/;
  if (!pattern.test(clean)) {
    const limit = places ? '12 位整數及 2 位小數' : '12 位整數';
    throw new Error(label + '的格式有誤，最多輸入 ' + limit + '。');
  }
  const amount = scaledDecimal(clean, places);
  if (amount === 0n && !allowZero) throw new Error(label + '必須大於 0。');
  return amount.toString();
}

function readRate(value, currency, base) {
  const clean = (value ?? '').trim();
  const label = currency + ' 兌 ' + base + ' 的匯率';
  if (!clean) throw new Error('請輸入 ' + label + '。');
  if (!/^(?:\d{1,12}(?:\.\d{1,12})?|\.\d{1,12})$/.test(clean)) {
    throw new Error(label + '最多可輸入 12 位整數及 12 位小數。');
  }
  const rate = scaledDecimal(clean, ratePlaces);
  if (rate === 0n) throw new Error(label + '必須大於 0。');
  return rate.toString();
}

function decimal(amount, places, grouped = true, trim = false) {
  const factor = 10n ** BigInt(places);
  const sign = amount < 0n ? '−' : '';
  const positive = amount < 0n ? -amount : amount;
  const whole = positive / factor;
  let fraction = places ? String(positive % factor).padStart(places, '0') : '';
  if (trim) fraction = fraction.replace(/0+$/, '');
  return sign + (grouped ? group.format(whole) : String(whole)) + (fraction ? '.' + fraction : '');
}

const number = (amount, currency) => decimal(amount, currencies[currency][2]);
const inputAmount = (amount, currency) => decimal(BigInt(amount), currencies[currency][2], false, true);
const rateText = value => decimal(BigInt(value), ratePlaces, false, true);
const money = (amount, currency) => currency + ' ' + number(amount, currency);
const rounded = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
const balanceCost = (wallet, basis = wallet.withFees) => rounded(wallet.units * basis.numerator, basis.denominator);
const percent = (part, total) => total ? Number(rounded(part * 1000n, total)) / 10 : 0;

function averageCostAmount(wallet, currency, base, basis = wallet.withFees) {
  if (!wallet.units) return null;
  const precision = 7;
  const amount = rounded(basis.numerator * scale(currency) * (10n ** BigInt(precision)),
    basis.denominator * scale(base));
  return decimal(amount, precision, true, true);
}

function gcd(left, right) {
  while (right) {
    [left, right] = [right, left % right];
  }
  return left;
}

function paymentRateCurrencies(principalCurrency, feeCurrency, hasFee, base) {
  const paid = hasFee ? [principalCurrency, feeCurrency] : [principalCurrency];
  return [...new Set(paid)].filter(currency => currency !== base);
}

function exchangeCosts(row, base) {
  const principalScale = scale(row.principalCurrency);
  const feeScale = scale(row.feeCurrency);
  const rate = currency => currency === base ? rateScale : BigInt(row.rates[currency]);
  const principal = BigInt(row.principal) * rate(row.principalCurrency) * scale(base);
  const fee = BigInt(row.fee);
  const feeCost = fee ? fee * rate(row.feeCurrency) * scale(base) : 0n;
  return {
    beforeFees: rounded(principal, rateScale * principalScale),
    withFees: rounded(principal * feeScale + feeCost * principalScale, rateScale * principalScale * feeScale)
  };
}

function acquire(basis, balance, updatedBalance, cost) {
  const numerator = balance * basis.numerator + cost * basis.denominator;
  const denominator = updatedBalance * basis.denominator;
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function calculate(book) {
  const wallets = new Map();
  const rows = [];
  // Sorting is stable. Entries on the same date retain their original recording order.
  const entries = book.entries.filter(isActive).sort((a, b) => a.date.localeCompare(b.date));
  const zeroBasis = { numerator: 0n, denominator: 1n };
  for (const entry of entries) {
    const amount = BigInt(entry.amount);
    const wallet = wallets.get(entry.currency) ?? { units: 0n, beforeFees: zeroBasis, withFees: zeroBasis };
    let costBeforeFees;
    let cost;
    if (entry.type === 'exchange') {
      const costs = exchangeCosts(entry, book.base);
      const units = wallet.units + amount;
      wallet.beforeFees = acquire(wallet.beforeFees, wallet.units, units, costs.beforeFees);
      wallet.withFees = acquire(wallet.withFees, wallet.units, units, costs.withFees);
      wallet.units = units;
      costBeforeFees = costs.beforeFees;
      cost = costs.withFees;
    } else {
      if (amount > wallet.units) {
        throw new Error(entry.date + ' 的 ' + entry.currency + ' 消費餘額不足（可用 ' +
          money(wallet.units, entry.currency) + '，消費 ' + money(amount, entry.currency) + '）。');
      }
      const before = balanceCost(wallet);
      const beforeWithoutFees = balanceCost(wallet, wallet.beforeFees);
      wallet.units -= amount;
      // Allocate the difference in rounded balances to keep the ledger balanced to the smallest unit.
      cost = before - balanceCost(wallet);
      costBeforeFees = beforeWithoutFees - balanceCost(wallet, wallet.beforeFees);
    }
    wallets.set(entry.currency, wallet);
    rows.push({ ...entry, cost, costBeforeFees, balance: wallet.units, remaining: balanceCost(wallet) });
  }
  return { wallets, rows };
}

function validateBook(book) {
  if (!book || ![1, 2, bookVersion].includes(book.version) || !isCurrency(book.base) || !Array.isArray(book.entries)) {
    throw new Error('備份格式不符。請選擇由此工具匯出的 JSON 檔。');
  }
  const ids = new Set();
  const entries = [];
  const validMinor = (value, currency, allowZero = false) =>
    typeof value === 'string' && /^\d{1,14}$/.test(value) &&
    (allowZero || BigInt(value) > 0n) && BigInt(value) < 10n ** 12n * scale(currency);
  for (const savedRow of book.entries) {
    let row = savedRow;
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) ||
        !validDate(row.date) || !isCurrency(row.currency) || row.currency === book.base ||
        !validMinor(row.amount, row.currency) || typeof row.note !== 'string' || row.note.length > 100 ||
        !['exchange', 'expense'].includes(row.type)) {
      throw new Error('備份中的交易格式不符。');
    }
    if (!isActive(row)) {
      const deletedAt = typeof row.deletedAt === 'string' ? Date.parse(row.deletedAt) : NaN;
      if (!Number.isFinite(deletedAt) || new Date(deletedAt).toISOString() !== row.deletedAt) {
        throw new Error('備份中的刪除時間有誤。');
      }
    }
    if (row.type === 'exchange') {
      if (book.version === 1) {
        row = { ...row, principalCurrency: book.base, feeCurrency: book.base, rates: {} };
      }
      if (!isCurrency(row.principalCurrency) || !isCurrency(row.feeCurrency) ||
          !validMinor(row.principal, row.principalCurrency) || !validMinor(row.fee, row.feeCurrency, true)) {
        throw new Error('備份中的換匯本金或手續費有誤。');
      }
      const required = paymentRateCurrencies(row.principalCurrency, row.feeCurrency, BigInt(row.fee) > 0n, book.base);
      const rates = row.rates;
      if (!rates || typeof rates !== 'object' || Array.isArray(rates) ||
          Object.keys(rates).length !== required.length || !required.every(currency =>
            has(rates, currency) && typeof rates[currency] === 'string' && /^[1-9]\d{0,23}$/.test(rates[currency]))) {
        throw new Error('備份中的換匯匯率有誤或缺少。');
      }
    }
    if (row.type === 'expense' && !has(categories, row.category)) {
      throw new Error('備份中的消費類別有誤。');
    }
    if ((row.place !== undefined && (typeof row.place !== 'string' || row.place.length > maxPlaceLength)) ||
        (row.coordinates !== undefined && !validCoordinates(row.coordinates))) {
      throw new Error('備份中的交易地點有誤。');
    }
    ids.add(row.id);
    entries.push(row);
  }
  const updated = { ...book, version: bookVersion, entries };
  calculate(updated);
  return updated;
}
