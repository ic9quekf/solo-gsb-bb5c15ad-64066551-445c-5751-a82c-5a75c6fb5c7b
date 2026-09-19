'use strict';

const path = require('path');
const express = require('express');
const { computeImposition } = require('./src/imposition');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * 拼版计算接口。
 * 请求体：{
 *   totalPages, sheetsPerSignature, binding: 'left'|'right', flip: 'long'|'short',
 *   paperThicknessMm?, maxCompensationMm?   // 爬移补偿可选参数（mm，缺省/为 0 即关闭）
 * }
 * 响应：拼版清单 JSON（与前端「导出拼版清单 JSON」内容一致），
 *       每个页位带 offsetMm（横向爬移偏移，左正右负、右装订反转；空白页同样保留）。
 */
app.post('/api/impose', (req, res) => {
  try {
    const result = computeImposition(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`骑马钉拼版预演已启动: http://localhost:${PORT}`);
});
