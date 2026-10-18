# 少女精修 v3

以使用者提供的正面、側面、背面圖片為造型參考。這是可旋轉、可變形的三維角色，並非以平面圖替換遊戲模型，也不是原作者的模型檔。

## 已修改

- 身高 1.56m；修窄肩線與肢體，將中立站姿雙腿收回髖部下方。
- 調整下巴、鼻形、唇部、眼周和臉頰，保留真實皮膚 UV、虹膜與透明睫毛。
- 棕色低馬尾與側分瀏海，以 916 條連續髮束導引生成。Blender 使用 25,648 根原生髮絲曲線；遊戲使用相同導引的透明髮束網格。
- 方領、肩帶、合身腰線與及膝淡綠裙；單片連續裙面、平滑細分及布料厚度。
- 同一份 GLB 接入模型檢視、可玩遊戲與 36 秒深海動畫，19 個執行期骨架關節帶動肩、肘、頭部及雙腿，馬尾和裙襬隨水流擺動。

## 檢視與檔案

- `model-review.html?view=face`：臉部；切換少女、側面、背面，滑鼠拖曳旋轉。
- `cinematic.html`：精修角色的即時深海動畫。
- `assets/previews/v3/{portrait,front,side,back,face-front}.png`：Cycles 真實模型棚拍。
- `assets/refined/girl_reference_v3.blend`：可編輯四邊面、原生髮絲、打包貼圖與棚拍場景。
- `assets/usd/girl.glb`：網頁實際載入的角色。
- `assets/usd/girl.usda`：相同已細分網格、UV 與材質的 USD，使用網格髮束。
- `assets/previews/v3/web-verification.json`、`game-verification.json`：瀏覽器與骨架驗證記錄。

重新生成：`/home/spark/env_isaaclab/bin/python assets/scripts/rebuild_realistic.py`，會使用精修流程，避免回退到 v2 模型。Blender 路徑可由 `DEEPSEA_BLENDER_BIN` 和 `DEEPSEA_BLENDER_TOOLS` 指定。預設使用此次配置於 `/tmp/deepsea-tools` 的 ARM64 可攜版；系統清除暫存後需重新配置或指定可用 Blender。

## 品質範圍

正面與侧面輪廓、低馬尾、瀏海、五官與裙裝已重新製作。臉部身份、髮束細節與原作仍有差異；網頁的髮束、皮膚光散射及裙襬動作也與離線 Cycles／原作不同。衣服目前使用程式變形，尚未進行全身布料與水流物理模擬。棚拍圖片與遊戲截圖分別保留，方便直接比較。

## 來源

人體拓撲與形態調整來源為 [MakeHuman](https://github.com/makehumancommunity/makehuman) 的 CC0 基礎人體與 targets。皮膚、眼睛、眉毛與睫毛來源為明確標示 CC0 的 [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)。髮型、裙裝、導引路徑與遊戲整合於本專案重新製作。參考造型為 [Incheon Airport Media Tower Girl and Whale](https://www.behance.net/gallery/248368373/Incheon-Airport-Media-Tower-Girl-and-Whale)。

本次使用 [Blender ARM64 社群建置](https://github.com/CoconutMacaroon/blender-arm64) 與 Cycles OPTIX 渲染；不是 Blender 官方 Linux ARM64 發行包。
