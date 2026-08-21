# 驾驶实验室 · 倒车入库 MVP

Three.js 低速驾驶几何实验室。当前重点不是拟真动力学，而是确保科目二低速场景下的车辆几何关系可解释、可复现，并逐步增加真正有教学价值的分析能力。

## 当前能力

- 后轴中心 kinematic bicycle model，精确圆弧积分与 Ackermann 前轮几何。
- W 前进、S 后退、A 左转、D 右转；整车多边形与库线使用 SAT 碰撞检测。
- 实时教练、预测车身扫掠、左右后视镜、参考轨迹偏差分析。
- 训练评分、可解释扣分、长期训练趋势与个人最好成绩。
- v0.7 互动轨迹回放：实际轨迹 vs 标准轨迹、时间轴、关键事件、3D 主场景同步。
- 复盘期间真实车辆物理与训练计时暂停，退出后精确恢复；驾驶输入与回放隔离。
- `lineCollisionDetails()` 能精确区分左侧、右侧、后侧库线；`replay-scene.mjs` 将该信息同步给 3D 回放。
- 新增 `replay-highlight.mjs`：把回放碰撞信息转换成稳定的库线/车身高亮状态，支持触线库线标签和脉冲强度，为主 Three.js 场景的红色闪烁与车身轮廓强调提供单一数据源。

## 验证

```bash
node physics-tests.mjs
node coach-tests.mjs
node session-tests.mjs
node replay-tests.mjs
node replay-scene-tests.mjs
node replay-runtime-tests.mjs
node replay-highlight-tests.mjs
node history-tests.mjs
```

重点回归覆盖坐标与 WASD 语义、前后可逆、Ackermann、SAT 压线、参考轨迹、实时教练、评分、异常时间戳恢复、严格回放点数预算、关键事件导航、3D 姿态恢复、复盘暂停计时，以及左/右/后库线诊断。`replay-highlight-tests.mjs` 额外验证重复/非法库线过滤、多库线标签、首次触线事件回退提示和高亮样式边界。

网页模块可单独做语法检查：

```bash
node --check replay-ui.mjs
node --check replay-highlight.mjs
```

## 说明

这是驾驶几何教学工具，不用于替代真实驾校训练或官方考试判定。车辆参数目前为典型紧凑型轿车近似值，后续可做成车型配置。
