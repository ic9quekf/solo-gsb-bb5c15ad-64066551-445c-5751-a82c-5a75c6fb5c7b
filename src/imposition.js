'use strict';

/**
 * 骑马钉（saddle-stitch）拼版计算核心。
 *
 * 基本概念：
 * - 一「帖」由若干张纸叠放后对折而成；每张纸正、反面各印 2 页，
 *   故 每帖页数 = 每帖张数 × 4。
 * - 同一帖内，第 i 张纸（由外向内，i 从 0 起）：
 *     小号页对 = start + 2i（正面）与 start + 2i + 1（其背面）
 *     大号页对 = end   - 2i（正面）与 end   - 2i - 1（其背面）
 * - 装订方向决定正面左右页位：
 *     左装订：正面左位放大号页、右位放小号页（第 1 页在右侧，书脊在左）；
 *     右装订：镜像（第 1 页在左侧，书脊在右）。
 * - 背面页位按双面翻转方式做坐标变换（纸张坐标系，与正面同一视角）：
 *     长边翻转：绕水平长边翻转，(x, y) -> (x, H - y)，左右页位不变，内容旋转 180°；
 *     短边翻转：绕垂直短边翻转，(x, y) -> (W - x, y)，左右页位互换，内容方向不变。
 * - 成品页数不足整帖时，在末尾自动补空白页。
 *
 * 爬移补偿（creep / shingling）：
 * - 帖内越靠里的纸折好后越向外「探出」，裁切时需把页位向订口方向挪回。
 * - 每帖第 i 张纸（i 从 0 起，由外向内）的补偿量：
 *     creepMm = min(i × 纸张厚度 × 2, 最大补偿量)
 *   （一张纸有正反两页叠在该层，故厚度 × 2。）
 * - 每个页位的横向偏移 offsetMm：左页位取正、右页位取负；右装订符号整体反转。
 * - 空白页同样保留 offsetMm；纸张厚度或最大补偿量为 0 时补偿关闭，偏移全部归零。
 */

const MAX_TOTAL_PAGES = 10000;
const MAX_SHEETS_PER_SIGNATURE = 100;
const MAX_PAPER_THICKNESS_MM = 10;
const MAX_COMPENSATION_MM = 100;
/** mm 数值统一保留 4 位小数，规避浮点尾差（如 0.1 * 2 = 0.20000000000000004）。 */
const MM_ROUND = 10000;

function toInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

/** 解析非负毫米参数；undefined / null 时取默认值 0（即不传 = 关闭爬移补偿）。 */
function toMm(value, max, label) {
  if (value === undefined || value === null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label}必须为 ≥ 0 的数字（单位 mm），0 表示关闭`);
  }
  if (n > max) {
    throw new Error(`${label}不能超过 ${max} mm`);
  }
  return Math.round(n * MM_ROUND) / MM_ROUND;
}

/** 生成一个页位；超出成品页数的页位为空白页（空白页同样带爬移偏移）。 */
function makeSlot(page, totalPages, offsetMm) {
  const slot = page > totalPages
    ? { page: null, blank: true }
    : { page, blank: false };
  slot.offsetMm = offsetMm;
  return slot;
}

/**
 * 计算整本册子的拼版。
 *
 * @param {object} input
 * @param {number} input.totalPages         成品页数（≥1 的整数）
 * @param {number} input.sheetsPerSignature 每帖张数（≥1 的整数）
 * @param {string} input.binding            装订方式：'left' | 'right'
 * @param {string} input.flip               双面翻转方式：'long' | 'short'
 * @param {number} [input.paperThicknessMm] 纸张厚度 mm（≥0，默认 0 = 关闭爬移补偿）
 * @param {number} [input.maxCompensationMm] 最大补偿量 mm（≥0，默认 0 = 关闭）
 * @returns {object} 拼版结果（按帖 -> 张 -> 正/背面 -> 左/右页位，每个页位带 offsetMm）
 */
function computeImposition(input) {
  const totalPages = toInteger(input && input.totalPages);
  const sheetsPerSignature = toInteger(input && input.sheetsPerSignature);
  const binding = input && input.binding;
  const flip = input && input.flip;
  const paperThicknessMm = toMm(input && input.paperThicknessMm, MAX_PAPER_THICKNESS_MM, '纸张厚度');
  const maxCompensationMm = toMm(input && input.maxCompensationMm, MAX_COMPENSATION_MM, '最大补偿量');

  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > MAX_TOTAL_PAGES) {
    throw new Error(`成品页数必须为 1 ~ ${MAX_TOTAL_PAGES} 的整数`);
  }
  if (!Number.isInteger(sheetsPerSignature) || sheetsPerSignature < 1 || sheetsPerSignature > MAX_SHEETS_PER_SIGNATURE) {
    throw new Error(`每帖张数必须为 1 ~ ${MAX_SHEETS_PER_SIGNATURE} 的整数`);
  }
  if (binding !== 'left' && binding !== 'right') {
    throw new Error("装订方式必须为 'left'（左装订）或 'right'（右装订）");
  }
  if (flip !== 'long' && flip !== 'short') {
    throw new Error("双面翻转方式必须为 'long'（长边翻转）或 'short'（短边翻转）");
  }

  // 任一参数为 0 即关闭补偿：所有偏移归零，页码排布与无补偿时完全一致。
  const creepEnabled = paperThicknessMm > 0 && maxCompensationMm > 0;

  const pagesPerSignature = sheetsPerSignature * 4;
  const signatureCount = Math.ceil(totalPages / pagesPerSignature);
  const paddedPages = signatureCount * pagesPerSignature;

  const signatures = [];
  for (let s = 0; s < signatureCount; s++) {
    const start = s * pagesPerSignature + 1;
    const end = start + pagesPerSignature - 1;
    const sheets = [];

    for (let i = 0; i < sheetsPerSignature; i++) {
      const lowFront = start + 2 * i; // 小号页（正面）
      const lowBack = lowFront + 1;   // 小号页之背
      const highFront = end - 2 * i;  // 大号页（正面）
      const highBack = highFront - 1; // 大号页之背

      // 正面左右页位（左装订：第 1 页在右；右装订镜像）
      const frontLeft = binding === 'left' ? highFront : lowFront;
      const frontRight = binding === 'left' ? lowFront : highFront;

      // 各正面页位「物理正后方」应承接的页（保证折叠后阅读顺序连续）
      const behindLeft = binding === 'left' ? highBack : lowBack;
      const behindRight = binding === 'left' ? lowBack : highBack;

      // 背面坐标变换：
      //   长边翻转 (x,y)->(x,H-y)：左右页位不变，背面内容需旋转 180°；
      //   短边翻转 (x,y)->(W-x,y)：左右页位互换，背面内容方向不变。
      const backLeft = flip === 'long' ? behindLeft : behindRight;
      const backRight = flip === 'long' ? behindRight : behindLeft;

      // 爬移补偿量：每帖由外向内第 i 张（i 从 0 起），封顶最大补偿量。
      const creepMm = creepEnabled
        ? (Math.round(Math.min(i * paperThicknessMm * 2, maxCompensationMm) * MM_ROUND) / MM_ROUND)
        : 0;
      // 左页位取正、右页位取负；右装订符号整体反转（|| 0 消除 -0）。
      const leftOffsetMm = (binding === 'left' ? creepMm : -creepMm) || 0;
      const rightOffsetMm = -leftOffsetMm || 0;

      const front = {
        left: makeSlot(frontLeft, totalPages, leftOffsetMm),
        right: makeSlot(frontRight, totalPages, rightOffsetMm),
      };
      const back = {
        left: makeSlot(backLeft, totalPages, leftOffsetMm),
        right: makeSlot(backRight, totalPages, rightOffsetMm),
      };

      // 标注每个背面页位物理上位于哪一正面页之后（用于校验折叠后的阅读顺序）
      back.left.backOf = flip === 'long' ? front.left.page : front.right.page;
      back.right.backOf = flip === 'long' ? front.right.page : front.left.page;

      sheets.push({ index: i + 1, creepMm, front, back });
    }

    signatures.push({ index: s + 1, pageStart: start, pageEnd: end, sheets });
  }

  return {
    meta: {
      app: 'saddle-stitch-imposition',
      version: '1.1.0',
      generatedAt: new Date().toISOString(),
    },
    input: { totalPages, sheetsPerSignature, binding, flip, paperThicknessMm, maxCompensationMm },
    creep: { enabled: creepEnabled, paperThicknessMm, maxCompensationMm },
    pagesPerSignature,
    signatureCount,
    paddedPages,
    blankPages: paddedPages - totalPages,
    signatures,
  };
}

module.exports = { computeImposition };
