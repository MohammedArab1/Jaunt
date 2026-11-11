(function () {
  try {
    var modes = ['light', 'dark', 'system']
    var accents = ['coral', 'sun', 'mint', 'sky', 'violet', 'punch', 'lime']
    var stored = window.localStorage.getItem('jaunt.appearance')
    var parsed = stored ? JSON.parse(stored) : null
    var mode = parsed && modes.indexOf(parsed.mode) !== -1 ? parsed.mode : 'dark'
    var accent = parsed && accents.indexOf(parsed.accent) !== -1 ? parsed.accent : 'coral'
    var resolved =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode
    document.documentElement.dataset.theme = resolved
    document.documentElement.dataset.accent = accent
    document.documentElement.style.colorScheme = resolved
    var meta = document.getElementById('theme-color-meta')
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#F6F1E8' : '#0B0A10')
  } catch (_error) {
    document.documentElement.dataset.theme = 'dark'
    document.documentElement.dataset.accent = 'coral'
  }
})()
