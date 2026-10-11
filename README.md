# Deep Sea Fall — 少女與鯨（混合架構）

垂直手機深海墜落遊戲：**Web 3D 可玩** + **Isaac Sim 寫實過場**。

靈感來自 [Incheon Airport Media Tower Girl and Whale](https://www.behance.net/gallery/248368373/Incheon-Airport-Media-Tower-Girl-and-Whale)。

## 架構

| 層級 | 技術 | 用途 |
|------|------|------|
| **可玩遊戲（手機）** | Three.js WebGL 3D | `index.html` — 霧、光柱、少女／鯨網格、深度生物群系 |
| **經典 2D** | Canvas 2D | `2d.html` |
| **寫實 cinematic** | Isaac Lab / Isaac Sim | `isaac_cinematic/` — Spark GPU 渲染垂直下潛預告片 |

## 遊玩（Web 3D）

```bash
cd ~/will/DeepSeaFall
python3 -m http.server 8765
# 手機／瀏覽器：http://localhost:8765
# 2D：http://localhost:8765/2d.html
```

操作：拖曳游動、睡著補力、召喚鯨、加速、氣功標記、攻擊、AI Agent prompts。

## Isaac Sim cinematic

在已安裝 Isaac Lab 的 Spark 上：

```bash
cd ~/will/DeepSeaFall/isaac_cinematic
./run_cinematic.sh 90
# 輸出：output/deep_sea_isaac_cinematic.mp4
```

腳本會 headless 啟動 Isaac、以 Camera sensor 拍攝直式 720×1280 幀，再 ffmpeg 合成。

### 生成原創 USD（風格參考 Behance，非抓取對方檔案）

```bash
python assets/scripts/generate_usd_from_style.py
# 產出 assets/usd/girl.usda whale.usda deep_sea_stage.usda (+ .glb)
```

Isaac cinematic 會自動載入這些 USD；Web 3D 會載入對應 `.glb`。

## Demo 錄影

```bash
npm run record:long   # 長示範（Web）
npm run upload:gofile -- demo/...
```

## Repo

https://github.com/willnien10005914/DeepSeaFall
