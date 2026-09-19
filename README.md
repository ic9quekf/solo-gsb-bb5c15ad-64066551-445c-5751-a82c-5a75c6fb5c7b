# 骑马钉小册子拼版预演

基于 **Node.js + Express + 原生 Canvas** 的骑马钉（saddle-stitch）拼版预演 Web 应用。

输入成品页数、每帖张数、装订方向、双面翻转方式与纸张厚度后，系统会：

- 成品页数不足整帖时，**自动在末尾补空白页**；
- **按帖拆分页码**（每帖页数 = 每帖张数 × 4），生成每张纸正、反面的左右页位；
- 背面依据 **长边 / 短边翻转** 执行坐标变换，保证裁切折叠后的阅读顺序；
- 按纸张厚度计算 **爬移补偿（creep / shingling）**，给出每个页位（含空白页）的横向偏移 `offsetMm`，画布叠加显示原始页位与补偿后页位；
- 画布**逐张显示**纸面、页码、空白页位、爬移偏移与翻转方向示意；
- 一键**导出拼版清单 JSON**。

## 快速开始（Docker）

```bash
docker compose up --build
```

启动后访问：**http://localhost:8080**

## 本地开发

```bash
npm install
npm start          # 启动服务，默认 8080 端口（可用 PORT 环境变量覆盖）
npm test           # 运行拼版逻辑单元测试
```

## 拼版规则说明

- **帖与张**：一帖由若干张纸叠放对折而成，每张纸正反面各印 2 页，故每帖页数 = 每帖张数 × 4。
- **页码配对**：同一帖内由外向内，第 i 张纸的正面为「最大未排页 + 最小未排页」，背面为与其相邻的两页。
- **装订方向**：
  - 左装订：第 1 页在正面右页位（书脊在左）；
  - 右装订：镜像，第 1 页在正面左页位（书脊在右）。
- **双面翻转（背面坐标变换，纸张坐标系与正面同视角）**：
  - 长边翻转：绕水平长边翻转，`(x, y) → (x, H − y)`，背面左右页位不变，内容旋转 180°（页首朝下）；
  - 短边翻转：绕垂直短边翻转，`(x, y) → (W − x, y)`，背面左右页位互换，内容方向不变。
- **阅读顺序校验**：画布上每个背面页位都标注了它物理上位于哪一正面页之背（页码首尾相接）。

### 爬移补偿（creep / shingling）

配帖折叠后，帖内越靠里的纸越向外「探出」，整叠书口裁切时内侧页面的有效版面会偏小。补偿方式是把各页位向订口方向平移：

- 每帖第 `i` 张纸（**由外向内，`i` 从 0 起算**，每帖独立重新起算）：

  ```
  creepMm(i) = min(i × paperThicknessMm × 2, maxCompensationMm)
  ```

  （一张纸在该折叠层上叠有正反两页，故厚度 × 2。）
- 每个页位的横向偏移 **`offsetMm`**：**左页位取正、右页位取负**（正值表示向订口/折线方向平移）；**右装订时符号整体反转**。
- 正、背面同一张纸的左右页位共用同一组偏移；**空白页同样保留 `offsetMm`**。
- **纸张厚度或最大补偿量任一为 0（或不传）即关闭补偿**：所有 `offsetMm` 归零，页码排布与原拼版结果完全一致。
- 画布上以**灰色虚线框**表示原始页位、**橙色实线框**表示补偿后页位，并以橙色箭头标注偏移方向与数值（画布为 10 px/mm 的**示意放大**，非真实 1:1 比例）。

## API

### `POST /api/impose`

请求体（后两项为可选，缺省均按 `0` 处理 = 关闭爬移补偿）：

```json
{
  "totalPages": 16,
  "sheetsPerSignature": 2,
  "binding": "left",
  "flip": "short",
  "paperThicknessMm": 0.1,
  "maxCompensationMm": 2.0
}
```

- `totalPages`：成品页数，1 ~ 10000 的整数
- `sheetsPerSignature`：每帖张数，1 ~ 100 的整数
- `binding`：`left`（左装订）或 `right`（右装订）
- `flip`：`long`（长边翻转）或 `short`（短边翻转）
- `paperThicknessMm`：**可选**，单张纸厚度 mm，0 ~ 10，`0`（或缺省）关闭补偿
- `maxCompensationMm`：**可选**，最大补偿量 mm（封顶值），0 ~ 100，`0`（或缺省）关闭补偿

响应：完整拼版清单，与前端导出的 JSON 一致。顶层新增 `creep` 汇总；每张新增非负 `creepMm`；每个页位（含空白页）新增带符号的 `offsetMm`：

```json
{
  "input": {
    "totalPages": 16,
    "sheetsPerSignature": 2,
    "binding": "left",
    "flip": "short",
    "paperThicknessMm": 0.1,
    "maxCompensationMm": 2
  },
  "creep": { "enabled": true, "paperThicknessMm": 0.1, "maxCompensationMm": 2 },
  "pagesPerSignature": 8,
  "signatureCount": 2,
  "paddedPages": 16,
  "blankPages": 0,
  "signatures": [
    {
      "index": 1,
      "pageStart": 1,
      "pageEnd": 8,
      "sheets": [
        {
          "index": 1,
          "creepMm": 0,
          "front": {
            "left": { "page": 8, "blank": false, "offsetMm": 0 },
            "right": { "page": 1, "blank": false, "offsetMm": 0 }
          },
          "back": {
            "left": { "page": 2, "blank": false, "backOf": 1, "offsetMm": 0 },
            "right": { "page": 7, "blank": false, "backOf": 8, "offsetMm": 0 }
          }
        },
        {
          "index": 2,
          "creepMm": 0.2,
          "front": {
            "left": { "page": 6, "blank": false, "offsetMm": 0.2 },
            "right": { "page": 3, "blank": false, "offsetMm": -0.2 }
          },
          "back": {
            "left": { "page": 4, "blank": false, "backOf": 3, "offsetMm": 0.2 },
            "right": { "page": 5, "blank": false, "backOf": 6, "offsetMm": -0.2 }
          }
        }
      ]
    }
  ]
}
```

兼容性说明：

- 不传新参数的旧调用完全可用，行为与旧版一致（仅输出中多出值为 `0` 的偏移字段）；
- 当补偿关闭时，所有 `offsetMm` 为 `0`、每张 `creepMm` 为 `0`。

参数非法时返回 `400` 与错误信息。另提供 `GET /api/health` 健康检查。

## 目录结构

```
├── server.js            # Express 服务：静态页面 + /api/impose
├── src/imposition.js    # 拼版计算核心（按帖拆分、正反面页位、翻转坐标变换、爬移补偿）
├── public/              # 前端（原生 Canvas 逐张绘制、爬移叠加框、JSON 导出）
│   ├── index.html
│   ├── app.js
│   └── style.css
├── test/imposition.test.js
├── Dockerfile
└── docker-compose.yml
```
