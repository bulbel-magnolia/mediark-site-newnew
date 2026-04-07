/**
 * 统一侧边栏：动态用户信息 + 退出登录
 * 在平台页面（dashboard, patients, prescription, knowledge）中引入
 */

(function () {
  // 从 sessionStorage 读取登录用户信息
  const user = JSON.parse(sessionStorage.getItem('mediark_current_user') || 'null');

  // 如果没有登录信息，尝试从后端获取
  if (!user) {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('未登录');
        return res.json();
      })
      .then(data => {
        const u = data.user;
        sessionStorage.setItem('mediark_current_user', JSON.stringify({
          id: u.id, name: u.displayName, username: u.username, role: u.role
        }));
        applySidebarUser(u.displayName, u.role);
      })
      .catch(() => {
        // 未登录，跳转登录页
        window.location.href = 'Login.html';
      });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      applySidebarUser(user.name, user.role);
    });
  }

  function applySidebarUser(displayName, role) {
    // 更新侧边栏用户信息
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

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
    } finally {
      sessionStorage.removeItem('mediark_current_user');
      window.location.href = 'Login.html';
    }
  };
})();
