(() => {
  const modal = document.querySelector('#article-modal');
  if (!modal) return;
  let internalClose = false;
  const hideOldBack = () => {
    const button = document.querySelector('#article-back');
    if (button) button.remove();
  };
  const observer = new MutationObserver(() => {
    hideOldBack();
    if (!modal.hidden && !history.state?.techCheckPost && !internalClose) {
      history.pushState({techCheckPost:true}, '', '#post');
    }
  });
  observer.observe(modal, {attributes:true, childList:true, subtree:true});
  hideOldBack();
  window.addEventListener('popstate', () => {
    if (!modal.hidden) {
      internalClose = true;
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      setTimeout(() => { internalClose = false; }, 0);
    }
  });
})();
