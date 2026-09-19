'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeImposition } = require('../src/imposition');

test('8 页 2 张/帖 左装订 短边翻转：经典 [8,1]/[2,7] 布局', () => {
  const r = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  assert.equal(r.signatureCount, 1);
  assert.equal(r.blankPages, 0);
  const [s1, s2] = r.signatures[0].sheets;
  assert.deepEqual([s1.front.left.page, s1.front.right.page], [8, 1]);
  assert.deepEqual([s1.back.left.page, s1.back.right.page], [2, 7]);
  assert.deepEqual([s2.front.left.page, s2.front.right.page], [6, 3]);
  assert.deepEqual([s2.back.left.page, s2.back.right.page], [4, 5]);
});

test('长边翻转：背面左右页位不变', () => {
  const r = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'long' });
  const [s1, s2] = r.signatures[0].sheets;
  assert.deepEqual([s1.back.left.page, s1.back.right.page], [7, 2]);
  assert.deepEqual([s2.back.left.page, s2.back.right.page], [5, 4]);
});

test('右装订：正面镜像，第 1 页在左', () => {
  const r = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'right', flip: 'short' });
  const [s1] = r.signatures[0].sheets;
  assert.deepEqual([s1.front.left.page, s1.front.right.page], [1, 8]);
  assert.deepEqual([s1.back.left.page, s1.back.right.page], [7, 2]);
});

test('右装订 + 长边翻转', () => {
  const r = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'right', flip: 'long' });
  const [s1] = r.signatures[0].sheets;
  assert.deepEqual([s1.front.left.page, s1.front.right.page], [1, 8]);
  assert.deepEqual([s1.back.left.page, s1.back.right.page], [2, 7]);
});

test('不足整帖自动补空白页', () => {
  const r = computeImposition({ totalPages: 10, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  assert.equal(r.signatureCount, 2);
  assert.equal(r.paddedPages, 16);
  assert.equal(r.blankPages, 6);
  const sig2 = r.signatures[1];
  assert.equal(sig2.pageStart, 9);
  assert.equal(sig2.pageEnd, 16);
  const [s1, s2] = sig2.sheets;
  // 第 1 张：正面 [空白(16), 9]，背面 [10, 空白(15)]
  assert.equal(s1.front.left.blank, true);
  assert.equal(s1.front.right.page, 9);
  assert.equal(s1.back.left.page, 10);
  assert.equal(s1.back.right.blank, true);
  // 第 2 张：全部为空白页
  assert.equal(s2.front.left.blank, true);
  assert.equal(s2.front.right.blank, true);
  assert.equal(s2.back.left.blank, true);
  assert.equal(s2.back.right.blank, true);
});

test('多帖拆分：16 页 1 张/帖 -> 4 帖，每帖 4 页', () => {
  const r = computeImposition({ totalPages: 16, sheetsPerSignature: 1, binding: 'left', flip: 'short' });
  assert.equal(r.signatureCount, 4);
  assert.equal(r.pagesPerSignature, 4);
  const sig2 = r.signatures[1];
  assert.deepEqual([sig2.pageStart, sig2.pageEnd], [5, 8]);
  const sheet = sig2.sheets[0];
  assert.deepEqual([sheet.front.left.page, sheet.front.right.page], [8, 5]);
  assert.deepEqual([sheet.back.left.page, sheet.back.right.page], [6, 7]);
});

test('12 页 3 张/帖：由外向内大小页配对', () => {
  const r = computeImposition({ totalPages: 12, sheetsPerSignature: 3, binding: 'left', flip: 'short' });
  const sheets = r.signatures[0].sheets;
  assert.deepEqual([sheets[0].front.left.page, sheets[0].front.right.page], [12, 1]);
  assert.deepEqual([sheets[1].front.left.page, sheets[1].front.right.page], [10, 3]);
  assert.deepEqual([sheets[2].front.left.page, sheets[2].front.right.page], [8, 5]);
  assert.deepEqual([sheets[2].back.left.page, sheets[2].back.right.page], [6, 7]);
});

test('backOf 标注背面页位的物理承接关系', () => {
  const short = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  const s1 = short.signatures[0].sheets[0];
  // 短边翻转：背面左位在正面右页（第 1 页）之背
  assert.equal(s1.back.left.backOf, 1);
  assert.equal(s1.back.right.backOf, 8);
  const long = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'long' });
  const l1 = long.signatures[0].sheets[0];
  // 长边翻转：背面左位在正面左页（第 8 页）之背
  assert.equal(l1.back.left.backOf, 8);
  assert.equal(l1.back.right.backOf, 1);
});

test('参数校验', () => {
  assert.throws(() => computeImposition({ totalPages: 0, sheetsPerSignature: 1, binding: 'left', flip: 'short' }), /成品页数/);
  assert.throws(() => computeImposition({ totalPages: 8.5, sheetsPerSignature: 1, binding: 'left', flip: 'short' }), /成品页数/);
  assert.throws(() => computeImposition({ totalPages: 8, sheetsPerSignature: 0, binding: 'left', flip: 'short' }), /每帖张数/);
  assert.throws(() => computeImposition({ totalPages: 8, sheetsPerSignature: 1, binding: 'middle', flip: 'short' }), /装订方式/);
  assert.throws(() => computeImposition({ totalPages: 8, sheetsPerSignature: 1, binding: 'left', flip: 'none' }), /翻转方式/);
});

/* ------------------------------ 爬移补偿（creep） ------------------------------ */

test('向后兼容：不传爬移参数时 paperThicknessMm/maxCompensationMm 缺省为 0', () => {
  const r = computeImposition({ totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  assert.equal(r.input.paperThicknessMm, 0);
  assert.equal(r.input.maxCompensationMm, 0);
  assert.deepEqual(r.creep, { enabled: false, paperThicknessMm: 0, maxCompensationMm: 0 });
  r.signatures.forEach((sig) => {
    sig.sheets.forEach((sheet) => {
      assert.equal(sheet.creepMm, 0);
      [sheet.front, sheet.back].forEach((side) => {
        ['left', 'right'].forEach((k) => assert.equal(side[k].offsetMm, 0));
      });
    });
  });
});

test('兼容旧结果：偏移为 0 时页码排布与原拼版完全一致', () => {
  const a = computeImposition({ totalPages: 12, sheetsPerSignature: 3, binding: 'left', flip: 'short' });
  const b = computeImposition({ totalPages: 12, sheetsPerSignature: 3, binding: 'left', flip: 'short', paperThicknessMm: 0.1, maxCompensationMm: 0 });
  assert.equal(b.creep.enabled, false);
  const strip = (res) => JSON.stringify(res, (key, value) => (
    key === 'offsetMm' || key === 'creepMm' || key === 'creep' || key === 'generatedAt'
    || key === 'paperThicknessMm' || key === 'maxCompensationMm'
      ? undefined : value
  ));
  assert.equal(strip(a), strip(b));
});

test('爬移量 = min(i × 厚度 × 2, 上限)，左装订左正右负，正背面相同', () => {
  const r = computeImposition({
    totalPages: 32, sheetsPerSignature: 4, binding: 'left', flip: 'short',
    paperThicknessMm: 0.1, maxCompensationMm: 0.5,
  });
  assert.deepEqual(r.creep, { enabled: true, paperThicknessMm: 0.1, maxCompensationMm: 0.5 });
  const sheets = r.signatures[0].sheets;
  assert.deepEqual(sheets.map((s) => s.creepMm), [0, 0.2, 0.4, 0.5]); // 0.6 被上限截为 0.5
  sheets.forEach((sheet, i) => {
    assert.equal(sheet.front.left.offsetMm, sheet.creepMm);
    assert.equal(sheet.back.left.offsetMm, sheet.creepMm);
    assert.equal(sheet.front.right.offsetMm, i === 0 ? 0 : -sheet.creepMm);
    assert.equal(sheet.back.right.offsetMm, i === 0 ? 0 : -sheet.creepMm);
  });
});

test('右装订：爬移符号整体反转（左负右正）', () => {
  const r = computeImposition({
    totalPages: 16, sheetsPerSignature: 2, binding: 'right', flip: 'long',
    paperThicknessMm: 0.1, maxCompensationMm: 2,
  });
  const [s1, s2] = r.signatures[0].sheets;
  assert.equal(s1.creepMm, 0);
  assert.equal(s1.front.left.offsetMm, 0);
  assert.equal(s1.front.right.offsetMm, 0);
  assert.equal(s2.creepMm, 0.2);
  assert.equal(s2.front.left.offsetMm, -0.2);
  assert.equal(s2.front.right.offsetMm, 0.2);
  assert.equal(s2.back.left.offsetMm, -0.2);
  assert.equal(s2.back.right.offsetMm, 0.2);
});

test('多帖各自从 i=0 重新起算爬移', () => {
  const r = computeImposition({
    totalPages: 16, sheetsPerSignature: 1, binding: 'left', flip: 'short',
    paperThicknessMm: 0.1, maxCompensationMm: 2,
  });
  assert.equal(r.signatureCount, 4);
  r.signatures.forEach((sig) => {
    assert.equal(sig.sheets[0].creepMm, 0);
    assert.equal(sig.sheets[0].front.left.offsetMm, 0);
    assert.equal(sig.sheets[0].front.right.offsetMm, 0);
  });
});

test('空白页同样保留爬移偏移', () => {
  const r = computeImposition({
    totalPages: 10, sheetsPerSignature: 2, binding: 'left', flip: 'short',
    paperThicknessMm: 0.1, maxCompensationMm: 2,
  });
  const sig2 = r.signatures[1];
  // 第 1 张 creep = 0
  assert.equal(sig2.sheets[0].front.left.offsetMm, 0);
  // 第 2 张（i=1）creep = 0.2；该张全部为空白页
  const s2 = sig2.sheets[1];
  assert.equal(s2.creepMm, 0.2);
  assert.equal(s2.front.left.blank, true);
  assert.equal(s2.front.right.blank, true);
  assert.equal(s2.back.left.blank, true);
  assert.equal(s2.back.right.blank, true);
  assert.equal(s2.front.left.offsetMm, 0.2);
  assert.equal(s2.front.right.offsetMm, -0.2);
  assert.equal(s2.back.left.offsetMm, 0.2);
  assert.equal(s2.back.right.offsetMm, -0.2);
  // 第 1 帖无补白，页码排布不受影响
  assert.deepEqual(
    r.signatures[0].sheets.map((s) => [s.front.left.page, s.front.right.page]),
    [[8, 1], [6, 3]]
  );
});

test('爬移参数校验：负数 / 非数字 / 超上限均报错', () => {
  const base = { totalPages: 8, sheetsPerSignature: 1, binding: 'left', flip: 'short' };
  assert.throws(() => computeImposition({ ...base, paperThicknessMm: -0.1 }), /纸张厚度/);
  assert.throws(() => computeImposition({ ...base, paperThicknessMm: 'abc' }), /纸张厚度/);
  assert.throws(() => computeImposition({ ...base, paperThicknessMm: 11 }), /纸张厚度/);
  assert.throws(() => computeImposition({ ...base, maxCompensationMm: -1 }), /最大补偿量/);
  assert.throws(() => computeImposition({ ...base, maxCompensationMm: NaN }), /最大补偿量/);
  assert.throws(() => computeImposition({ ...base, maxCompensationMm: 101 }), /最大补偿量/);
});

test('显式传 0 或缺省均可关闭爬移，且结果等价', () => {
  const base = { totalPages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'short' };
  const omitted = computeImposition(base);
  const zeroThickness = computeImposition({ ...base, paperThicknessMm: 0, maxCompensationMm: 2 });
  const zeroMax = computeImposition({ ...base, paperThicknessMm: 0.1, maxCompensationMm: 0 });
  [zeroThickness, zeroMax].forEach((r) => {
    assert.equal(r.creep.enabled, false);
    r.signatures[0].sheets.forEach((sheet, i) => {
      assert.equal(sheet.creepMm, 0);
      assert.equal(sheet.front.left.offsetMm, 0);
      assert.equal(sheet.front.right.offsetMm, 0);
    });
    assert.deepEqual(
      JSON.parse(JSON.stringify(r.signatures)),
      JSON.parse(JSON.stringify(omitted.signatures))
    );
  });
});
