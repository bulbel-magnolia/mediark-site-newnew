/**
 * toast.js — MediArk 轻量级 Toast 通知组件
 * 纯 vanilla JS，无依赖，使用 Tailwind 类名
 * 用法：toast.success('成功') / toast.error('失败') / toast.warning('注意') / toast.info('提示')
 */
;(function () {
    'use strict';

    // 创建 toast 容器（fixed 定位，右上角）
    var container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
    container.style.maxWidth = '380px';
    container.style.width = '100%';
    document.body.appendChild(container);

    // 注入 slide-in / slide-out 动画的关键帧
    var style = document.createElement('style');
    style.textContent =
        '@keyframes toast-slide-in{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}' +
        '@keyframes toast-slide-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(100%)}}' +
        '.toast-in{animation:toast-slide-in .3s ease forwards}' +
        '.toast-out{animation:toast-slide-out .3s ease forwards}';
    document.head.appendChild(style);

    // 类型 -> 配色 & 图标（Tailwind 类名 + Font Awesome 图标）
    var presets = {
        success: {
            bg:   'bg-green-50 border-green-200',
            text: 'text-green-800',
            icon: 'fa-solid fa-circle-check text-green-500'
        },
        error: {
            bg:   'bg-red-50 border-red-200',
            text: 'text-red-800',
            icon: 'fa-solid fa-circle-xmark text-red-500'
        },
        warning: {
            bg:   'bg-orange-50 border-orange-200',
            text: 'text-orange-800',
            icon: 'fa-solid fa-triangle-exclamation text-orange-500'
        },
        info: {
            bg:   'bg-blue-50 border-blue-200',
            text: 'text-blue-800',
            icon: 'fa-solid fa-circle-info text-blue-500'
        }
    };

    /**
     * 显示一条 toast
     * @param {string} type    — success | error | warning | info
     * @param {string} message — 通知文本
     * @param {number} [duration=3000] — 自动消失时间（ms）
     */
    function show(type, message, duration) {
        duration = duration || 3000;
        var p = presets[type] || presets.info;

        var el = document.createElement('div');
        el.className =
            'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg cursor-pointer toast-in '
            + p.bg;

        el.innerHTML =
            '<i class="' + p.icon + ' mt-0.5 text-lg flex-shrink-0"></i>' +
            '<span class="text-sm font-medium leading-snug ' + p.text + '">' + escapeHtml(message) + '</span>';

        container.appendChild(el);

        // 点击提前关闭
        el.addEventListener('click', function () { dismiss(el); });

        // 自动关闭
        var timer = setTimeout(function () { dismiss(el); }, duration);

        function dismiss(node) {
            clearTimeout(timer);
            node.classList.remove('toast-in');
            node.classList.add('toast-out');
            node.addEventListener('animationend', function () {
                if (node.parentNode) node.parentNode.removeChild(node);
            });
        }
    }

    // 简单的 HTML 转义，防止 XSS
    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // 导出全局 API
    window.toast = {
        success: function (msg, ms) { show('success', msg, ms); },
        error:   function (msg, ms) { show('error',   msg, ms); },
        warning: function (msg, ms) { show('warning', msg, ms); },
        info:    function (msg, ms) { show('info',    msg, ms); }
    };
})();
