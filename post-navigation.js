(() => {
  const modal = document.querySelector('#article-modal');
  if (!modal) return;
  const hideOldBack = () => {
    const button = document.querySelector('#article-back');
    if (button) button.remove();
  };
  const observer = new MutationObserver(hideOldBack);
  observer.observe(modal, { attributes: true, childList: true, subtree: true });
  hideOldBack();
})();
