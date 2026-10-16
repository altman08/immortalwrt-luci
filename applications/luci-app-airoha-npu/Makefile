# This is free software, licensed under the Apache License, Version 2.0 .

include $(TOPDIR)/rules.mk

PKG_VERSION:=1.1.0
PKG_RELEASE:=2

PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE
LUCI_MAINTAINER:=Ryan Chen <rchen14b@gmail.com>

LUCI_TITLE:=LuCI Airoha SoC Status (NPU, CPU, Frame Engine)
LUCI_URL:=https://github.com/rchen14b/luci-app-airoha-npu
LUCI_DESCRIPTION:=Airoha EN7581 and AN7583 NPU, Frame Engine and PPE status, \
	device-tree Ethernet topology, hardware-aware Wi-Fi monitoring and offload \
	controls. Runtime CPU controls use cpufreq or direct PLL; each boot defaults to ondemand \
	with a 1200 MHz ceiling.
LUCI_DEPENDS:=+luci-base +rpcd +jsonfilter +jshn +iw +firewall4 +kmod-br-netfilter +kmod-nft-offload \
	@TARGET_airoha +@KERNEL_DEVMEM +@BUSYBOX_DEFAULT_DEVMEM +@BUSYBOX_CONFIG_DEVMEM \
	+@BUSYBOX_DEFAULT_TIMEOUT +@BUSYBOX_CONFIG_TIMEOUT

define Build/Prepare/luci-app-airoha-npu
	chmod 0755 $(PKG_BUILD_DIR)/root/etc/init.d/airoha-npu
	chmod 0755 $(PKG_BUILD_DIR)/root/usr/libexec/rpcd/luci.airoha_npu
endef

define Package/luci-app-airoha-npu/postinst
[ -n "$${IPKG_INSTROOT}" ] || { \
	/etc/init.d/airoha-npu enable
	/etc/init.d/rpcd restart
	rm -f /tmp/luci-indexcache.*
	rm -rf /tmp/luci-modulecache/
	exit 0
}
endef

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
