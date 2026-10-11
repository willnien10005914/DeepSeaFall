# Deep Sea Fall — 少女與鯨

垂直手機網頁遊戲，靈感來自 Incheon Airport Media Tower「Girl and Whale」的沉浸式垂直深海美學：少女從水面一路下墜，鯨魚陪伴推進、避開危險，深度愈深風格與音樂愈不同。

## 遊玩

```bash
cd ~/will/DeepSeaFall
python3 -m http.server 8765
# 手機或瀏覽器開啟 http://localhost:8765
```

或：

```bash
npm start
```

## 操作

| 操作 | 說明 |
|------|------|
| 拖曳螢幕 | 手動游動；往上拖可回頭撿寶 |
| 睡著補力 | 自由落體回復體力，可順便召喚鯨 |
| 召喚鯨 | 鯨魚推開石頭 / 敵生物 |
| 加速 | 加快下潛（耗少量體力） |
| 氣功標記 | 在石頭上留下魔法符號當路標 |
| 攻擊 | 依裝備招式砍殺敵對生物 |
| 手動 / AI Mode | AI 可選 Proactive / Careful / Hunt Treasure / Wander Deep |

## 系統

- **深度紀錄**：從水面往下公尺數，無止境生物群系輪替（表層→珊瑚→暮光→午夜→熱泉→深淵→超深淵）
- **體力**：受傷歸零會倒下；海草可復活或回復
- **外觀**：搜集寶物改變髮型、衣服、武器與攻擊特效
- **音樂**：Web Audio 程序生成 BGM / 特效（碰撞、寶物、鯨鳴、氣功、攻擊），並隨深度與 Agent prompt 變調

## Demo 錄影

```bash
npm run record
# 輸出 demo/deep_sea_fall_demo.webm 與 demo/deep_sea_fall_demo.mp4
```

## 參考

- [Behance — Incheon Airport Media Tower Girl and Whale](https://www.behance.net/gallery/248368373/Incheon-Airport-Media-Tower-Girl-and-Whale)
- 垂直沉浸構圖參考 YouTube `Vsjjjb-Ln8g`
- AI Agent 迭代開發概念參考 Aura AI 工作流（小步提示 → 測試 → 再調）
