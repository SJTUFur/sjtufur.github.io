(function () {
  const button = document.querySelector("[data-copy-qq]");
  const status = document.querySelector("[data-copy-status]");
  button?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyQq);
      status.textContent = "已复制 QQ，打开 QQ 添加好友即可。";
    } catch {
      status.textContent = `请手动复制管理员 QQ：${button.dataset.copyQq}`;
    }
  });
})();
