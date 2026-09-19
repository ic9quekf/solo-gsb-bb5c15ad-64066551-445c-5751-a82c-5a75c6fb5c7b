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
