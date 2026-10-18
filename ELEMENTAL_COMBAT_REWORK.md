# Deep Sea Fall v44

攻擊分成火焰、寒冰、冷火三系。回旋踢、月牙腿、破浪掌、雙飛踢是火焰；十字光劍、斜月劍、流光劍舞是寒冰；蓮華氣爆、星環震波、潮汐天光是冷火。參考是雙手火焰、踢擊火帶，以及掌心冷火。

火焰、冰塊和冷火的 24 幀動態是用 Spark 上已裝好的 Blender 5.1（`/tmp/deepsea-tools/blender/cmake-make/bin/blender`）粒子系統，加上風力與湍流力場烤出來的。場景存在 `assets/animation/elemental-combat-v44.blend`。瀏覽器播放這份烘焙，並加上四盞點光與出招時才投射的聚光陰影。Isaac Lab 當時已在跑 Q1 後空翻，所以沒有另開一個 Isaac 場景。

少女攻擊關節由裁剪過的 PPO 殘差策略驅動，彈簧積分和瀏覽器相同。獨立評估的均方根誤差約 0.0598 rad，零殘差是 0.0759 rad，大約低 21%。PPO 微調沒有再降低這個姿勢誤差，採用的是評估最好的那一份權重。細節在 `assets/policy/combat-ppo-training-v44.json`。
