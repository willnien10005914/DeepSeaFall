# Deep Sea Fall v44

攻擊分成火焰、寒冰、冷火三系。回旋踢、月牙腿、破浪掌、雙飛踢是火焰；十字光劍、斜月劍、流光劍舞是寒冰；蓮華氣爆、星環震波、潮汐天光是冷火。參考是雙手火焰、踢擊火帶，以及掌心冷火。

火焰、冰塊和冷火的 24 幀動態是用 Spark 上已裝好的 Blender 5.1（`/tmp/deepsea-tools/blender/cmake-make/bin/blender`）粒子系統，加上風力與湍流力場烤出來的。場景存在 `assets/animation/elemental-combat-v44.blend`。瀏覽器播放這份烘焙，並加上四盞點光與出招時才投射的聚光陰影。Isaac Lab 當時已在跑 Q1 後空翻，所以沒有另開一個 Isaac 場景。

v45 把火焰攻擊改成 [Realistic Fire Tutorial](https://youtu.be/mh9tyFnzSUw) 的元件。Blender 用球體火源、燃料 2、表面發射 1、對比 5 且尺寸 0.1 的雲紋理、模組化快取、解析度 64、適應範圍、反應速度 0.5、渦度 0.1 來烤熱度。著色把密度設為 0，熱度色帶最後一階稍暗，顏色色帶再乘上發射強度。遊戲裡分成焰心、焰身、較暗焰尖和火星，掌招掛在雙腕，踢招掛在雙踝。這些火焰畫在海水著色之後，避免紅光被水吸收成綠色。資料在 `assets/policy/elemental-dynamics-v45.json`，場景在 `assets/animation/fire-detail-v45.blend`。寒冰和冷火仍用 v44。

少女攻擊關節由裁剪過的 PPO 殘差策略驅動，彈簧積分和瀏覽器相同。獨立評估的均方根誤差約 0.0598 rad，零殘差是 0.0759 rad，大約低 21%。PPO 微調沒有再降低這個姿勢誤差，採用的是評估最好的那一份權重。細節在 `assets/policy/combat-ppo-training-v44.json`。
