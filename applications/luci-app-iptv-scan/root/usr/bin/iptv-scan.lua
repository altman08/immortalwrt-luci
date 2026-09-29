#!/usr/bin/lua

local socket = require('socket')
local uci = require('uci').cursor()

local CONFIG = 'iptv-scan'
local SECTION = 'main'
local LOCK_FILE = '/tmp/iptv-scan.lock'
local LOG_FILE = '/tmp/iptv-scan.log'

local function log(message)
	print(message)
	io.stdout:flush()
end

local function trim(value)
	return (value or ''):gsub('^%s+', ''):gsub('%s+$', '')
end

local function file_exists(path)
	local file = io.open(path, 'r')
	if file then
		file:close()
		return true
	end
	return false
end

local function is_safe_path(path)
	return type(path) == 'string' and path:sub(1, 1) == '/' and not path:find('../', 1, true)
end

local function pid_alive(pid)
	return pid and pid:match('^%d+$') and file_exists('/proc/' .. pid .. '/stat')
end

local function acquire_lock()
	local file = io.open(LOCK_FILE, 'r')
	if file then
		local pid = trim(file:read('*a'))
		file:close()
		if pid_alive(pid) then
			return false
		end
		os.remove(LOCK_FILE)
	end

	local self = io.open('/proc/self/stat', 'r')
	if not self then
		return false
	end
	local pid = self:read('*l'):match('^(%d+)')
	self:close()
	if not pid then
		return false
	end

	file = io.open(LOCK_FILE, 'w')
	if not file then
		return false
	end
	file:write(pid)
	file:close()
	return true
end

local function release_lock()
	os.remove(LOCK_FILE)
end

local function load_channel_map(path)
	local channels = {}
	local file = io.open(path, 'r')
	if not file then
		log('[提示] 未读取到频道映射文件：' .. path)
		return channels
	end

	for line in file:lines() do
		line = trim(line)
		if line ~= '' and line:sub(1, 1) ~= '#' then
			local name, address = line:match('^([^,]+),%s*(%d+%.%d+%.%d+%.%d+:%d+)%s*$')
			if name and address then
				channels[address] = trim(name)
			end
		end
	end
	file:close()
	return channels
end

local function get_network(interface)
	if not interface:match('^[%w_.%-]+$') then
		return nil, '扫描接口名称无效。'
	end

	local handle = io.popen('ubus call network.interface.' .. interface .. ' status 2>/dev/null')
	if not handle then
		return nil, '无法读取接口状态。'
	end
	local output = handle:read('*a')
	handle:close()

	local device = output:match('"l3_device"%s*:%s*"([^"]+)"') or interface
	local address = output:match('"address"%s*:%s*"(%d+%.%d+%.%d+%.%d+)"')
	if not address then
		return nil, '接口「' .. interface .. '」未取得 IPv4 地址。请确认 IPTV 网络已经连接。'
	end
	return { device = device, address = address }
end

local function parse_ranges(ranges)
	local result = {}
	if type(ranges) == 'string' then
		ranges = { ranges }
	end
	for _, value in ipairs(ranges or {}) do
		local prefix, port = trim(value):match('^(2[2-3]%d%.%d+%.%d+%.)%:(%d+)$')
		port = tonumber(port)
		if prefix and port and port > 0 and port < 65536 then
			table.insert(result, { prefix = prefix, port = port })
		else
			log('[跳过] 无效网段：「' .. tostring(value) .. '」。格式应为 239.1.2.:1234')
		end
	end
	return result
end

local function xml_escape(value)
	return (value or ''):gsub('&', '&amp;'):gsub('"', '&quot;'):gsub('<', '&lt;'):gsub('>', '&gt;')
end

local function classify(name)
	local upper = name:upper()
	if upper:find('CCTV', 1, true) then return '央视频道' end
	if name:find('卫视', 1, true) then return '卫视频道' end
	if name:find('体育', 1, true) or name:find('足球', 1, true) then return '体育频道' end
	if name:find('少儿', 1, true) or name:find('动画', 1, true) then return '少儿频道' end
	if name:find('电影', 1, true) or name:find('影视', 1, true) then return '影视频道' end
	return '其他频道'
end

local function quality(name)
	local upper = name:upper()
	if upper:find('4K', 1, true) or name:find('超高清', 1, true) then return '4K' end
	if upper:find('HD', 1, true) or name:find('高清', 1, true) then return '高清' end
	return '标清'
end

local function scan_address(address, port, source_ip, timeout)
	local udp, error_message = socket.udp()
	if not udp then
		return false, error_message
	end
	udp:settimeout(timeout)
	udp:setoption('reuseaddr', true)

	local bound, bind_error = udp:setsockname('0.0.0.0', port)
	if not bound then
		udp:close()
		return false, bind_error
	end

	local joined, join_error = udp:setoption('ip-add-membership', {
		multiaddr = address,
		interface = source_ip
	})
	if not joined then
		udp:close()
		return false, join_error
	end

	local data = udp:receive()
	udp:close()
	if not data or #data == 0 then
		return false
	end

	local first = data:byte(1)
	return first == 0x47 or first == 0x80
end

local function write_playlists(channels, m3u_path, txt_path, epg_url, logo_base)
	local m3u, m3u_error = io.open(m3u_path, 'w')
	if not m3u then
		return nil, '无法写入 M3U 文件：' .. tostring(m3u_error)
	end
	local txt, txt_error = io.open(txt_path, 'w')
	if not txt then
		m3u:close()
		return nil, '无法写入 TXT 文件：' .. tostring(txt_error)
	end

	m3u:write('#EXTM3U')
	if epg_url ~= '' then
		m3u:write(' x-tvg-url="' .. xml_escape(epg_url) .. '"')
	end
	m3u:write('\n')

	table.sort(channels, function(a, b)
		if a.group ~= b.group then return a.group < b.group end
		return a.name < b.name
	end)

	local last_group = nil
	for _, channel in ipairs(channels) do
		local attrs = ' group-title="' .. xml_escape(channel.group) .. '"'
		if logo_base ~= '' then
			attrs = attrs .. ' tvg-logo="' .. xml_escape(logo_base:gsub('/$', '') .. '/' .. channel.name .. '.png') .. '"'
		end
		m3u:write('#EXTINF:-1' .. attrs .. ',' .. channel.name .. '\n' .. channel.url .. '\n')
		if last_group ~= channel.group then
			txt:write('\n' .. channel.group .. ',#genre#\n')
			last_group = channel.group
		end
		txt:write(channel.name .. ',' .. channel.url .. '\n')
	end

	m3u:close()
	txt:close()
	return true
end

local function run()
	local interface = uci:get(CONFIG, SECTION, 'interface') or ''
	local timeout = tonumber(uci:get(CONFIG, SECTION, 'timeout')) or 0.5
	local map_file = uci:get(CONFIG, SECTION, 'channel_map_file') or '/etc/iptv-scan/channels.txt'
	local m3u_path = uci:get(CONFIG, SECTION, 'output_m3u') or '/www/iptv.m3u'
	local txt_path = uci:get(CONFIG, SECTION, 'output_txt') or '/www/iptv.txt'
	local scheme = uci:get(CONFIG, SECTION, 'url_scheme') or 'rtp'
	local epg_url = uci:get(CONFIG, SECTION, 'epg_url') or ''
	local logo_base = uci:get(CONFIG, SECTION, 'logo_base') or ''

	if timeout <= 0 or timeout > 10 then
		return nil, '接收超时必须在 0 到 10 秒之间。'
	end
	if scheme ~= 'rtp' and scheme ~= 'udp' then
		return nil, '播放协议必须为 rtp 或 udp。'
	end
	if not is_safe_path(map_file) or not is_safe_path(m3u_path) or not is_safe_path(txt_path) then
		return nil, '频道映射及输出文件必须使用安全的绝对路径。'
	end

	local network, network_error = get_network(interface)
	if not network then return nil, network_error end
	local ranges = parse_ranges(uci:get_list(CONFIG, SECTION, 'ranges'))
	if #ranges == 0 then return nil, '没有可用的组播网段。' end

	log('IPTV 组播扫描开始：' .. os.date('%Y-%m-%d %H:%M:%S'))
	log('扫描接口：' .. network.device .. '（' .. network.address .. '）')
	local names = load_channel_map(map_file)
	local found = {}
	local total = 0

	for _, task in ipairs(ranges) do
		local count = 0
		log('扫描网段：' .. task.prefix .. '1-255:' .. task.port)
		for suffix = 1, 255 do
			local address = task.prefix .. suffix
			total = total + 1
			local ok = scan_address(address, task.port, network.address, timeout)
			if ok then
				local endpoint = address .. ':' .. task.port
				local name = names[endpoint] or ('未命名频道 ' .. endpoint)
				local group = classify(name) .. ' - ' .. quality(name)
				table.insert(found, { name = name, group = group, url = scheme .. '://' .. endpoint })
				count = count + 1
				log('  发现：' .. name .. '（' .. endpoint .. '）')
			end
		end
		log('网段完成：发现 ' .. count .. ' 个有效频道。')
	end

	local saved, save_error = write_playlists(found, m3u_path, txt_path, epg_url, logo_base)
	if not saved then return nil, save_error end
	log('扫描完成：共检测 ' .. total .. ' 个地址，发现 ' .. #found .. ' 个频道。')
	log('M3U 播放列表：' .. m3u_path)
	log('TXT 播放列表：' .. txt_path)
	return true
end

if not acquire_lock() then
	log('扫描任务已在运行中。')
	os.exit(1)
end

local ok, result, error_message = xpcall(run, debug.traceback)
release_lock()
if not ok then
	log('扫描异常：' .. tostring(result))
	os.exit(1)
end
if not result then
	log('扫描失败：' .. tostring(error_message))
	os.exit(1)
end
