#!/usr/bin/env python3
"""Integration checks in a disposable, unmounted x86-64 OpenWrt rootfs.

Run as root: python3 tests/backend.py /path/to/extracted/openwrt-rootfs
Real BusyBox ash, jshn, jsonfilter and UCI are used; hardware is simulated.
"""
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest

BASE = Path(sys.argv.pop(1)).resolve() if len(sys.argv) > 1 else None
PACKAGE = Path(__file__).resolve().parents[1]


@unittest.skipUnless(BASE and os.geteuid() == 0, 'requires root and an extracted OpenWrt x86-64 rootfs')
class Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='airoha-npu-regression-')
        cls.root = Path(cls.temp.name) / 'root'
        shutil.copytree(str(BASE), str(cls.root), symlinks=True)
        # Stock release rootfs images may omit the timeout applet. The package
        # selects it in Kconfig; use the host utility when testing such images.
        if not (cls.root / 'usr/bin/timeout').exists() and not (cls.root / 'bin/timeout').exists():
            host_timeout = shutil.which('timeout')
            dependencies = subprocess.check_output(['ldd', host_timeout], universal_newlines=True)
            for binary in [host_timeout] + re.findall(r'(/[\w/+.\-]+)', dependencies):
                destination = cls.root / binary.lstrip('/')
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(binary, str(destination))
        for source in (PACKAGE / 'root').rglob('*'):
            target = cls.root / source.relative_to(PACKAGE / 'root')
            if source.is_symlink():
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists() or target.is_symlink():
                    target.unlink()
                target.symlink_to(os.readlink(str(source)))
            elif source.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(source), str(target))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def write(self, path, data, executable=False):
        target = self.root / path.lstrip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_symlink():
            target.unlink()
        if isinstance(data, bytes):
            target.write_bytes(data)
        else:
            target.write_text(data, encoding='utf-8')
        if executable:
            target.chmod(0o755)
        return target

    def run_shell(self, script, input_text=None):
        result = subprocess.run(['chroot', str(self.root), '/bin/sh', '-c', script],
                                input=input_text, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                universal_newlines=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def rpc(self, method, args=None):
        output = self.run_shell('/usr/libexec/rpcd/luci.airoha_npu call ' + method,
                                None if args is None else json.dumps(args))
        return json.loads(output)

    def read(self, path):
        return (self.root / path.lstrip('/')).read_text(encoding='utf-8').strip()

    def node(self, path, **properties):
        (self.root / path.lstrip('/')).mkdir(parents=True, exist_ok=True)
        for name, value in properties.items():
            self.write(path + '/' + name, struct.pack('>I', value) if isinstance(value, int)
                       else value.encode('utf-8') + b'\0')

    def setUp(self):
        for name in ['sys', 'proc', 'tmp']:
            directory = self.root / name
            if directory.is_dir():
                shutil.rmtree(str(directory))
            directory.mkdir()
        for path in (self.root / 'etc/sysctl.d').glob('90-airoha-npu-*'):
            path.unlink()
        self.write('/dev/null', '')
        self.write('/usr/bin/logger', '#!/bin/sh\nprintf "%s\\n" "$*" >> /tmp/logger\n', True)
        self.write('/etc/init.d/firewall', '#!/bin/sh\necho "$*" >> /tmp/firewall-calls\n', True)
        self.write('/etc/config/firewall', "config defaults\n option flow_offloading '0'\n option flow_offloading_hw '0'\nconfig zone\n option name 'wan'\n list network 'internet'\n")
        self.write('/etc/config/network', "config interface 'wan'\n option device 'pon0'\n")
        self.node('/proc/device-tree', model='Test ONU', compatible='nokia,xg-040g-mf-ubi\0airoha,an7583')
        self.node('/proc/device-tree/soc/ethernet@1fb50000', status='okay')
        for name, value in {
            'scaling_governor': 'performance', 'scaling_min_freq': '500000',
            'scaling_max_freq': '1600000', 'scaling_cur_freq': '1200000',
            'cpuinfo_cur_freq': '1200000', 'scaling_available_governors': 'ondemand performance schedutil',
            'scaling_available_frequencies': '400000 500000 600000 1000000 1200000 1400000 1600000',
            'scaling_boost_frequencies': '1300000 1500000'
        }.items():
            self.write('/sys/devices/system/cpu/cpufreq/policy0/' + name, value + '\n')
        self.write('/proc/stat', 'cpu 100 0 50 300 50 0 0 0 20 0\ncpu0 100 0 50 300 50 0 0 0 20 0\ncpu2 20 0 10 60 10 0 0 0 0 0\n')
        self.write('/proc/sys/kernel/random/boot_id', 'boot-fixture\n')
        self.write('/proc/interrupts', '8: 0 airoha-npu-wdt\n')
        for name in ['bridge-nf-filter-vlan-tagged', 'bridge-nf-pass-vlan-input-dev',
                     'bridge-nf-filter-pppoe-tagged', 'bridge-nf-call-iptables',
                     'bridge-nf-call-ip6tables', 'bridge-nf-call-arptables']:
            self.write('/proc/sys/net/bridge/' + name, '0\n')
        self.write('/sys/kernel/debug/ppe/entries',
                   '00001 BND IPv4 5T orig=10.0.0.2:1000->1.1.1.1:443 new=203.0.113.1:1000->1.1.1.1:443 packets=9007199254740993 bytes=18446744073709551615\n'
                   '00002 UNB IPv6 3T orig=2001:db8::1->2001:db8::2\n'
                   '00003 BND L2B eth=aa:bb:cc:dd:ee:ff->11:22:33:44:55:66 vlan=100\n')
        self.write('/usr/sbin/devmem', '#!/bin/sh\n[ "$#" = 1 ] || exit 99\nprintf "0x%08x\\n" "$1"\n', True)

    def test_cpu_runtime_bounds_and_boot_reset_without_uci(self):
        self.assertIn('error', self.rpc('setMaxFreq', {'freq': 1500000}))
        self.assertIn('error', self.rpc('setMaxFreq', {'freq': 700000}))
        self.assertIn('error', self.rpc('setMaxFreq', {'freq': 499999}))
        self.assertIn('error', self.rpc('setGovernor', {'governor': '.*'}))
        self.assertEqual(self.rpc('setMaxFreq', {'freq': 1400000})['result'], 'ok')
        self.assertEqual(self.rpc('setGovernor', {'governor': 'schedutil'})['result'], 'ok')
        self.assertFalse((self.root / 'etc/config/airoha_npu').exists())
        self.run_shell('. /etc/init.d/airoha-npu; boot')
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_governor'), 'ondemand')
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_max_freq'), '1200000')
        self.assertTrue((self.root / 'etc/rc.d/S89airoha-npu').is_symlink())
        self.assertIn('setOverclock', self.run_shell('/usr/libexec/rpcd/luci.airoha_npu list'))

    def mock_pll(self, soc):
        self.node('/proc/device-tree', compatible='airoha,' + soc)
        self.write('/usr/sbin/devmem', '''#!/bin/sh
file=/tmp/pll/$1
if [ "$#" = 3 ]; then
    echo "$*" >> /tmp/pll-writes
    [ ! -e /tmp/pll-fail-write ] || exit 1
    printf '%s\\n' "$3" > "$file"
fi
cat "$file"
''', True)
        registers = {
            '0x1fa201e0': 1, '0x1efbe640': 0xa0, '0x1efbe7c0': 0x1200,
            '0x1fa20268': 0x12340000, '0x1fa202b4': 0x18abcdef,
            '0x1fa202ac': 0x18abcdef, '0x1fa202b0': 0x44, '0x1fa202b8': 0x00200080
        }
        for address, value in registers.items():
            self.write('/tmp/pll/' + address, '0x{:08X}\n'.format(value))

    def test_pll_both_soc_layouts_readback_and_runtime_only(self):
        for soc in ['an7581', 'an7583']:
            self.mock_pll(soc)
            self.assertEqual(self.rpc('getStatus')['pll_freq_mhz'], 1200)
            for mhz, expected_pcw, expected_posdiv in [(1400, 28, 0), (1600, 32, 0), (950, 38, 1)]:
                result = self.rpc('setOverclock', {'freq_mhz': mhz})
                self.assertEqual(result.get('actual_mhz'), mhz, result)
                self.assertEqual(self.rpc('getDashboard')['status']['pll_freq_mhz'], mhz)
                pcw_reg = '0x1fa202ac' if soc == 'an7583' else '0x1fa202b4'
                pcw = int(self.read('/tmp/pll/' + pcw_reg), 16)
                self.assertEqual(pcw & 0xffffff, 0xabcdef)
                self.assertEqual(pcw >> 24, expected_pcw)
                posdiv = int(self.read('/tmp/pll/0x1fa202b8'), 16)
                self.assertEqual((posdiv >> (18 if soc == 'an7583' else 4)) & 7, expected_posdiv)
                self.assertEqual(int(self.read('/tmp/pll/0x1efbe7c0'), 16), 0x1200)
                self.assertEqual(int(self.read('/tmp/pll/0x1fa201e0'), 16), 1)
                self.assertEqual(int(self.read('/tmp/pll/0x1fa20268'), 16), 0x12340000)
                self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_governor'), 'performance')
            self.assertFalse((self.root / 'tmp/airoha-npu.cpu.lock').exists())
            self.assertFalse((self.root / 'etc/config/airoha_npu').exists())
        # No PLL register writes are performed by the boot service.
        writes = self.read('/tmp/pll-writes')
        self.run_shell('. /etc/init.d/airoha-npu; boot')
        self.assertEqual(self.read('/tmp/pll-writes'), writes)
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_governor'), 'ondemand')

    def test_pll_rejects_invalid_input_unknown_soc_and_concurrent_cpu_write(self):
        self.mock_pll('an7583')
        for value in [None, '', 'oops', -1, 499, 1650, 1251, 1200.5, '0800', '1;reboot', '99999999999999999999']:
            self.assertIn('error', self.rpc('setOverclock', {'freq_mhz': value}))
        self.node('/proc/device-tree', compatible='vendor,unknown')
        self.assertIn('error', self.rpc('setOverclock', {'freq_mhz': 1400}))
        self.assertFalse((self.root / 'tmp/pll-writes').exists())
        (self.root / 'tmp/airoha-npu.cpu.lock').mkdir()
        for method, args in [('setOverclock', {'freq_mhz': 1400}), ('setGovernor', {'governor': 'ondemand'}), ('setMaxFreq', {'freq': 1200000})]:
            self.assertIn('in progress', self.rpc(method, args)['error'])

    def test_pll_unavailable_failed_writes_and_readback_mismatch(self):
        self.mock_pll('an7583')
        self.write('/tmp/pll/0x1fa202ac', 'unreadable\n')
        self.assertIn('unavailable', self.rpc('setOverclock', {'freq_mhz': 1400})['error'])
        self.assertFalse((self.root / 'tmp/pll-writes').exists())
        self.mock_pll('an7583')
        self.write('/tmp/pll-fail-write', '')
        self.assertIn('error', self.rpc('setOverclock', {'freq_mhz': 1400}))
        (self.root / 'tmp/pll-fail-write').unlink()
        # A device that silently ignores the PCW write must not report success.
        mock = self.read('/usr/sbin/devmem').replace('printf', '[ "$1" = 0x1fa202ac ] && exit 0\n    printf')
        self.write('/usr/sbin/devmem', mock, True)
        self.assertIn('readback', self.rpc('setOverclock', {'freq_mhz': 1400})['error'])

    def test_boot_fallback_and_high_minimum(self):
        self.write('/sys/devices/system/cpu/cpufreq/policy0/scaling_min_freq', '1600000\n')
        self.write('/sys/devices/system/cpu/cpufreq/policy0/scaling_available_frequencies', '500000 1000000 1400000\n')
        self.run_shell('. /etc/init.d/airoha-npu; boot')
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_max_freq'), '1000000')
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_min_freq'), '500000')

    def test_no_supported_governor_does_not_invent_one(self):
        self.write('/sys/devices/system/cpu/cpufreq/policy0/scaling_available_governors', 'performance\n')
        self.run_shell('. /etc/init.d/airoha-npu; boot')
        self.assertEqual(self.read('/sys/devices/system/cpu/cpufreq/policy0/scaling_governor'), 'performance')
        self.assertIn('unavailable', self.read('/tmp/logger'))

    def test_removed_controls_cannot_modify_network_settings(self):
        methods = json.loads(self.run_shell('/usr/libexec/rpcd/luci.airoha_npu list'))
        acl = json.loads(self.read('/usr/share/rpcd/acl.d/luci-app-airoha-npu.json'))['luci-app-airoha-npu']
        allowed = acl['read']['ubus']['luci.airoha_npu'] + acl['write']['ubus']['luci.airoha_npu']
        before_firewall = self.read('/etc/config/firewall')
        bridge = self.root / 'proc/sys/net/bridge'
        before_bridge = {f.name: f.read_bytes() for f in bridge.iterdir()}
        for method in ['getFlowOffload', 'getVlanOffload', 'getPppoeOffload', 'getApModeOffload',
                       'getDeviceMode', 'setFlowOffload', 'setVlanOffload', 'setPppoeOffload', 'setApModeOffload']:
            self.assertNotIn(method, methods)
            self.assertNotIn(method, allowed)
            self.assertEqual(self.rpc(method, {'enabled': 1}), {'error': 'Invalid method'})
        dashboard = self.rpc('getDashboard')
        self.assertEqual(set(dashboard), {'status', 'ppe', 'topology', 'token', 'frame_engine'})
        self.assertEqual(self.read('/etc/config/firewall'), before_firewall)
        self.assertEqual({f.name: f.read_bytes() for f in bridge.iterdir()}, before_bridge)
        self.assertFalse((self.root / 'tmp/firewall-calls').exists())
        self.assertFalse(list((self.root / 'etc/sysctl.d').glob('90-airoha-npu-*')))
        self.assertFalse((self.root / 'usr/share/airoha-npu/offload.sh').exists())
        self.assertFalse((self.root / 'lib/upgrade/keep.d/luci-app-airoha-npu').exists())

    def test_ppe_summary_precision_cache_and_recovery(self):
        data = self.rpc('getPpeEntries')
        self.assertEqual((data['total'], data['bound'], data['ipv4'], data['ipv6'], data['l2b']), (3, 2, 1, 1, 1))
        self.assertEqual(data['entries'][0]['bytes'], '18446744073709551615')
        self.assertEqual(data['entries'][0]['packets'], '9007199254740993')
        self.write('/sys/kernel/debug/ppe/entries', '')
        self.assertEqual(self.rpc('getPpeEntries')['total'], 3)
        self.write('/tmp/luci-airoha-npu.ppe.cache', '0\n{}\n')
        self.assertEqual(self.rpc('getPpeEntries')['total'], 0)
        (self.root / 'sys/kernel/debug/ppe/entries').unlink()
        (self.root / 'tmp/luci-airoha-npu.ppe.cache').unlink()
        self.assertFalse(self.rpc('getPpeEntries')['available'])

    def test_dt_split_ports_disabled_parents_gdm3_and_wifi_presence(self):
        base = '/proc/device-tree/soc/ethernet@1fb50000'
        self.node(base + '/ethernet@1', reg=1, status='okay', **{'phy-mode': 'internal'})
        self.node(base + '/ethernet@2', reg=2, status='disabled')
        self.node(base + '/ethernet@2/ethernet-port@0', reg=0, **{'openwrt,netdev-name': 'hidden'})
        self.node(base + '/ethernet@3', reg=3, status='okay', **{'phy-mode': 'usxgmii'})
        for index, name in enumerate(['lan5', 'lan6']):
            self.node(base + '/ethernet@3/ethernet-port@' + str(index), reg=index, **{'openwrt,netdev-name': name})
            self.write('/sys/class/net/' + name + '/carrier', '1\n')
            self.write('/sys/class/net/' + name + '/speed', '10000\n')
        self.node('/proc/device-tree/soc/switch@1fb58000/ports/port@1', reg=1, label='lan1')
        topo = self.rpc('getTopology')
        self.assertFalse(topo['has_wifi'])
        self.assertEqual([p['netdev'] for p in topo['ports']], ['', 'lan5', 'lan6', 'lan1'])
        self.assertTrue(topo['ports'][1]['split'])
        frame = self.rpc('getFrameEngine')
        self.assertEqual(frame['gdm3']['tx'], 0x1fb51204)
        self.assertNotIn('gdm2', frame)
        self.assertNotIn('gdm4', frame)
        self.assertFalse(self.rpc('getTokenInfo')['has_wifi'])
        (self.root / 'sys/class/ieee80211/phy7').mkdir(parents=True)
        self.assertTrue(self.rpc('getTopology')['has_wifi'])
        self.assertTrue(self.rpc('getTokenInfo')['has_wifi'])

    def test_pon_native_vendor_fallback_and_unknown_values(self):
        self.assertFalse(self.rpc('getTopology')['pon']['present'])
        self.write('/etc/config/pon', "config line 'line0'\n option device 'optic0'\n")
        line = '/sys/kernel/debug/airoha-xpon-optic0/line'
        registration = '/sys/kernel/debug/airoha-xpon-optic0/registration'
        self.write(line, 'configured_mode: gpon\nactive_mode: xgspon\noptical_signal: 1\n')
        self.write(registration, 'onu_state: O5\n')
        pon = self.rpc('getDashboard')['topology']['pon']
        self.assertEqual((pon['netdev'], pon['mode_name'], pon['los'], pon['onu_state']), ('optic0', 'xgspon', 0, 'O5'))
        self.assertEqual((pon['down_mbps'], pon['up_mbps']), (10000, 10000))
        self.write(line, 'active_mode: epon-1g\noptical_signal: 0\n')
        pon = self.rpc('getTopology')['pon']
        self.assertEqual((pon['mode_name'], pon['los']), ('epon-1g', 1))
        # Unknown/absent data must not claim light, registration or line rates.
        self.write(line, 'active_mode: none\noptical_signal: -1\n')
        self.write(registration, 'onu_state: invalid\n')
        pon = self.rpc('getTopology')['pon']
        self.assertIsNone(pon['los'])
        self.assertIsNone(pon['down_mbps'])
        self.assertEqual(pon['onu_state'], '')
        self.write('/sys/module/xpon_10g/parameters/mode', '6\n')
        self.write('/proc/tc3162/los_status', '0\n')
        self.write('/proc/xgpon/state', 'O3\n')
        pon = self.rpc('getTopology')['pon']
        self.assertEqual((pon['mode_name'], pon['los'], pon['onu_state']), ('xgpon', 1, 'O3'))
        self.assertEqual((pon['down_mbps'], pon['up_mbps']), (10000, 2500))

    def test_cpu_ticks_preserve_core_ids_and_exclude_guest(self):
        status = self.rpc('getStatus')
        self.assertEqual(status['boot_id'], 'boot-fixture')
        self.assertEqual(status['cpu_ticks'], [
            {'core': 0, 'total': '500', 'idle': '350'},
            {'core': 2, 'total': '100', 'idle': '70'}])
        (self.root / 'proc/stat').unlink()
        self.assertEqual(self.rpc('getStatus')['cpu_ticks'], [])

    def test_ppe_partitions_follow_soc_boundaries_and_cover_truncated_rows(self):
        records = ''.join('%05x BND IPv4 5T\n' % i for i in range(1100))
        records += '01fff UNB IPv6 3T\n02000 BND L2B\n03fff FIN IPv4 5T\n04000 BND IPv4 5T\n'
        self.write('/sys/kernel/debug/ppe/entries', records)
        self.node('/proc/device-tree', compatible='airoha,an7581')
        ppe = self.rpc('getPpeEntries')
        self.assertEqual((ppe['ppe1'], ppe['ppe2'], ppe['dram']), (1101, 2, 1))
        self.assertEqual((ppe['ppe1_bound'], ppe['ppe2_bound'], ppe['dram_bound']), (1100, 1, 1))
        self.assertEqual(ppe['total'], 1104)
        self.assertEqual(len(ppe['entries']), 1024)
        self.assertTrue(ppe['truncated'])
        self.assertGreater(ppe['sampled_at'], 0)
        # A different SoC invalidates the cache, even within its two-second TTL.
        self.node('/proc/device-tree', compatible='airoha,an7583')
        ppe = self.rpc('getPpeEntries')
        self.assertEqual((ppe['ppe_count'], ppe['ppe1'], ppe['dram']), (1, 1101, 3))
        self.assertNotIn('ppe2', ppe)
        self.node('/proc/device-tree', compatible='vendor,unknown')
        self.assertNotIn('ppe_count', self.rpc('getPpeEntries'))
        self.node('/proc/device-tree', compatible='airoha,an7581')
        self.write('/sys/kernel/debug/ppe/entries', '42\n')
        legacy = self.rpc('getPpeEntries')
        self.assertEqual((legacy['total'], legacy['bound']), (42, 42))
        self.assertNotIn('ppe_count', legacy)

    def test_light_dashboard_never_reads_debugfs_and_keeps_snapshot_counts(self):
        # A cold light call must not fall back to a live table read.
        cold = self.rpc('getDashboard', {'ppe': 0})
        self.assertTrue(cold['ppe']['deferred'])
        self.assertFalse(cold['ppe']['available'])
        full = self.rpc('getDashboard', {'ppe': 1})
        cache = '/tmp/luci-airoha-npu.ppe.cache'
        header, payload = self.read(cache).split('\n', 1)
        fields = header.split()
        fields[1] = '1'
        self.write(cache, ' '.join(fields) + '\n' + payload + '\n')
        entries = self.root / 'sys/kernel/debug/ppe/entries'
        entries.unlink()
        os.mkfifo(str(entries))  # Opening this for a live read would stall.
        self.write('/sys/devices/system/cpu/cpufreq/policy0/scaling_cur_freq', '600000\n')
        light = self.rpc('getDashboard', {'ppe': 0})
        self.assertTrue(light['ppe']['deferred'])
        self.assertNotIn('entries', light['ppe'])
        self.assertEqual(light['status']['offload_total'], full['ppe']['total'])
        self.assertEqual(light['status']['offload_bound'], full['ppe']['bound'])
        self.assertEqual(light['status']['cpu_cur_freq'], 600000)
        self.assertTrue((self.root / cache.lstrip('/')).exists())
        entries.unlink()
        self.write('/sys/kernel/debug/ppe/entries', '04000 BND IPv6 3T\n')
        # Missing argument retains the full API used by older callers.
        updated = self.rpc('getDashboard')
        self.assertEqual(updated['ppe']['total'], 1)
        self.assertEqual(updated['ppe']['entries'][0]['index'], '04000')
        self.assertEqual(updated['status']['offload_total'], 1)
        self.write(cache, 'broken\nnot JSON')
        self.assertFalse(self.rpc('getDashboard', {'ppe': 0})['ppe']['available'])
        self.assertEqual(self.rpc('getDashboard', {'ppe': 'invalid'})['ppe']['total'], 1)

    def test_aggregate_survives_absent_devmem_and_matches_ppe_snapshot(self):
        self.write('/usr/sbin/devmem', '#!/bin/sh\nexit 1\n', True)
        data = self.rpc('getDashboard')
        self.assertIn('error', data['frame_engine'])
        self.assertEqual(data['status']['offload_total'], data['ppe']['total'])
        self.assertEqual(data['status']['offload_bound'], data['ppe']['bound'])
        self.assertEqual(data['status']['pll_freq_mhz'], 0)
        self.assertFalse(data['topology']['has_wifi'])
        self.assertIn('1200000', data['status']['cpu_avail_freqs'])
        self.assertNotIn('1600000', data['status']['cpu_avail_freqs'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
