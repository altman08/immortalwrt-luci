# Airoha SoC 状态

支持 AN7581 / AN7583 的 NPU、保留内存、Frame Engine、PSE 队列和 PPE 流表状态。

- CPU 页面通过内核 cpufreq 修改 governor 和最高频率，只影响当前运行，不保存到 UCI。
- 每次启动应用 `ondemand` 和 `1200MHz` 最高频率。缺少该档位时使用不超过
  `1200MHz` 的最高可用档位；缺少 `ondemand` 时保留内核设置并记录日志。
- cpufreq 可选频率为内核实际提供且位于 `500–1400MHz` 的档位。
- 恢复独立的直接 PLL 超频入口，支持 AN7581 / AN7583，范围 `500–1600MHz`、
  步进 `50MHz`，可越过内核现有的 1200MHz OPP 上限。应用时切换到 `performance`，
  超过 1400MHz 时先弹窗确认。不保存、不在开机应用；内核调频或温控可能重设 PLL。页面读取 PLL 显示超频状态。
  寄存器不可读、芯片未知、频率不合法或写入/回读失败时返回错误。
- 端口拓扑来自设备树及 sysfs，包括交换机端口、GDM3 和拆分的 GDM/NBQ 子端口。
  只有检测到无线 PHY 才显示 Wi-Fi，AP 频段按实际运行频率识别。
- `getDashboard` 一次返回页面状态，PPE 单次解析同时生成流表和计数，原子发布的
  缓存有效期为两秒；最多返回 1024 条，页面显示前 100 条，统计覆盖完整快照。
  字节、报文计数以十进制字符串返回，避免 64 位整数丢失精度。

编译依赖包括 `rpcd`、`jsonfilter`、`jshn`、`iw`，以及内核 `/dev/mem`
和 BusyBox `devmem` / `timeout`。`devmem` 用于 Frame Engine / PLL 读取及手动 PLL 调频。
启动脚本和 rc.d 链接随包安装；安装或升级插件不会立即重设正在运行的 CPU。

从带“卸载控制”的旧版本升级时，安装脚本会清理插件生成的三个
`/etc/sysctl.d/90-airoha-npu-{vlan,pppoe,ap}.conf` 文件，停止保留旧桥接开关配置。
不会重设当前防火墙或运行中的 sysctl 参数，也不会卸载固件已有的内核模块。
手动覆盖文件时，需要额外在路由器删除旧文件：

```sh
rm -f /usr/share/airoha-npu/offload.sh /lib/upgrade/keep.d/luci-app-airoha-npu \
  /etc/sysctl.d/90-airoha-npu-vlan.conf /etc/sysctl.d/90-airoha-npu-pppoe.conf \
  /etc/sysctl.d/90-airoha-npu-ap.conf
```

验证：

```sh
# root 权限，使用解压后的 OpenWrt x86-64 rootfs；测试会复制到临时目录，不挂载设备。
python3 tests/backend.py /path/to/openwrt-rootfs

# Node.js 20+，安装 Playwright 及其 Chromium 运行依赖。
node tests/ui.cjs
```

后端测试使用真实 BusyBox ash、UCI、jshn 和 jsonfilter；硬件使用隔离的模拟数据。
测试验证卸载控制接口已移除，且状态查询不会修改防火墙或桥接参数。
浏览器测试覆盖有线 / Wi-Fi、调频失败回退、超频确认和窄屏。
上述检查不代替 AN7581 / AN7583 的实机验证。
