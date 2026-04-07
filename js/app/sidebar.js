/**
 * 统一侧边栏：动态用户信息 + 退出登录
 * 在平台页面（dashboard, patients, prescription, knowledge）中引入
 * 兼容有后端和无后端（GitHub Pages）两种模式
 */

(function () {
  var user = JSON.parse(sessionStorage.getItem('mediark_current_user') || 'null');

  if (user) {
    // sessionStorage 里有用户信息，直接渲染
    document.addEventListener('DOMContentLoaded', function () {
      applySidebarUser(user.name, user.role);
    });
  } else {
    // 尝试从后端获取
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('未登录');
        return res.json();
      })
      .then(function (data) {
        var u = data.user;
        var userInfo = { id: u.id, name: u.displayName, username: u.username, role: u.role };
        sessionStorage.setItem('mediark_current_user', JSON.stringify(userInfo));
        applySidebarUser(u.displayName, u.role);
      })
      .catch(function () {
        // 后端不可用或未登录 — 显示默认信息，不强制跳转
        // 这样 GitHub Pages 等静态部署也能正常浏览
        document.addEventListener('DOMContentLoaded', function () {
          applySidebarUser('访客', 'doctor');
        });
      });
  }

  function applySidebarUser(displayName, role) {
    var nameEl = document.getElementById('sidebar-user-name');
    var roleEl = document.getElementById('sidebar-user-role');
    var avatarEl = document.getElementById('sidebar-user-avatar');

    if (nameEl) nameEl.textContent = displayName || '用户';
    if (roleEl) roleEl.textContent = role === 'admin' ? '管理员' : '临床医生';
    if (avatarEl) avatarEl.textContent = (displayName || '?')[0].toUpperCase();
  }

  // 退出登录
  window.sidebarLogout = async function () {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
    } catch (e) { /* 后端不可用时忽略 */ }
    sessionStorage.removeItem('mediark_current_user');
    window.location.href = 'Login.html';
  };
})();
