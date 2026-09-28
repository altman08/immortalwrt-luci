# This is free software, licensed under the Apache License, Version 2.0 .

include $(TOPDIR)/rules.mk

PKG_VERSION:=1.0.1
PKG_RELEASE:=2

PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE
LUCI_MAINTAINER:=Ryan Chen <rchen14b@gmail.com>

LUCI_TITLE:=LuCI Airoha SoC Status (NPU, CPU, Frame Engine)
LUCI_URL:=https://github.com/rchen14b/luci-app-airoha-npu
LUCI_DESCRIPTION:=Status page for Airoha EN7581 and AN7583 SoCs: NPU state and \
	reserved memory, the Frame Engine port counters and PSE queues, the PPE \
	flow offload table, plus CPU frequency, governor and direct PLL overclock.
LUCI_DEPENDS:=+luci-base @TARGET_airoha

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
