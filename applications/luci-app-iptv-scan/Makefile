# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-iptv-scan
PKG_VERSION:=2.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=PonWrt

LUCI_TITLE:=IPTV Multicast Scanner
LUCI_DESCRIPTION:=Scan IPTV multicast streams and generate Chinese M3U playlists.
LUCI_DEPENDS:=+luci-lua-runtime +libuci-lua +rpcd-mod-ucode
LUCI_PKGARCH:=all

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
