export function setupDrawer({
  document,
  performance,
  bottomDrawer,
  drawerPeek,
  drawerPrimaryList,
  drawerSecondaryList,
  getSelectedPrimaryIds,
  getSelectedSecondaryIds,
  setSelectedPrimaryIds,
  setSelectedSecondaryIds,
  uniqueValidBoothIds,
  setPinnedMesh,
  setHoveredMesh,
  refreshMaterials,
  focusMesh,
  showToast,
  saveState,
  drawerItemDataFromId,
}) {
  let drawerDragState = null;
  let drawerDragSuppressUntil = 0;
  let isDrawerOpen = false;


  function commitSelectionArrays(primary, secondary) {
    setSelectedPrimaryIds(uniqueValidBoothIds(primary));
    setSelectedSecondaryIds(uniqueValidBoothIds(secondary));
  }

  function moveSelectionBetweenTiers(fromTier, fromIndex, toTier, toIndex) {
    const primary = [...getSelectedPrimaryIds()];
    const secondary = [...getSelectedSecondaryIds()];
    const fromList = fromTier === 'secondary' ? secondary : primary;
    const toList = toTier === 'secondary' ? secondary : primary;
    if (!fromList || !toList) return false;
    if (fromIndex < 0 || fromIndex >= fromList.length) return false;
    const [moved] = fromList.splice(fromIndex, 1);
    if (!moved) return false;
    const normalizedToIndex = Math.max(0, Math.min(toIndex, toList.length));
    if (fromList === toList && fromIndex < normalizedToIndex) {
      toList.splice(normalizedToIndex - 1, 0, moved);
    } else {
      toList.splice(normalizedToIndex, 0, moved);
    }
    commitSelectionArrays(primary, secondary);
    return true;
  }

  function clearDrawerDropTargets() {
    document.querySelectorAll('.drawer-list-wrap.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
  }

  function cleanupDrawerDrag() {
    if (drawerDragState?.ghost?.parentNode) drawerDragState.ghost.parentNode.removeChild(drawerDragState.ghost);
    if (drawerDragState?.placeholder?.parentNode) drawerDragState.placeholder.parentNode.removeChild(drawerDragState.placeholder);
    drawerDragState?.originButton?.classList.remove('is-dragging-origin');
    clearDrawerDropTargets();
    drawerDragState = null;
  }

  function drawerDropContextFromPoint(clientX, clientY) {
    const wrap = document.elementFromPoint(clientX, clientY)?.closest('.drawer-list-wrap');
    if (!wrap) return null;
    const tier = wrap.dataset.tier || 'primary';
    const list = wrap.querySelector('.drawer-list');
    if (!list) return { wrap, list: null, tier, index: 0 };
    const itemButton = document.elementFromPoint(clientX, clientY)?.closest('.drawer-item');
    if (itemButton && list.contains(itemButton)) {
      const li = itemButton.closest('li');
      const items = Array.from(list.children).filter((child) => child !== drawerDragState?.placeholder);
      const itemIndex = items.indexOf(li);
      const rect = li.getBoundingClientRect();
      const insertAfter = clientY > rect.top + rect.height / 2;
      return { wrap, list, tier, index: itemIndex + (insertAfter ? 1 : 0) };
    }
    return { wrap, list, tier, index: list.children.length };
  }

  function updateDrawerDrag(clientX, clientY) {
    if (!drawerDragState?.dragging) return;
    drawerDragState.lastClientX = clientX;
    drawerDragState.lastClientY = clientY;
    drawerDragState.ghost.style.transform = `translate(${clientX - drawerDragState.offsetX}px, ${clientY - drawerDragState.offsetY}px)`;
    clearDrawerDropTargets();
    const context = drawerDropContextFromPoint(clientX, clientY);
    if (!context) return;
    context.wrap.classList.add('is-drop-target');
    const { list, index } = context;
    const placeholder = drawerDragState.placeholder;
    if (!list) {
      context.wrap.appendChild(placeholder);
      return;
    }
    const items = Array.from(list.children).filter((child) => child !== placeholder);
    if (index >= items.length) list.appendChild(placeholder);
    else list.insertBefore(placeholder, items[index]);
  }

  function finishDrawerDrag(cancelled = false) {
    if (!drawerDragState) return;
    const state = drawerDragState;
    const didDrag = !!state.dragging;
    if (!cancelled && didDrag) {
      const wrap = state.placeholder.parentElement?.closest('.drawer-list-wrap');
      const tier = wrap?.dataset.tier || state.fromTier;
      const list = wrap?.querySelector('.drawer-list');
      const index = list ? Array.from(list.children).indexOf(state.placeholder) : 0;
      const changed = moveSelectionBetweenTiers(state.fromTier, state.fromIndex, tier, index);
      if (changed) {
        refreshMaterials();
        saveState(true);
      }
      drawerDragSuppressUntil = performance.now() + 320;
    }
    cleanupDrawerDrag();
  }

  function startDrawerDrag(event, button, item, tier, index) {
    const rect = button.getBoundingClientRect();
    const ghost = button.cloneNode(true);
    ghost.classList.add('drawer-drag-ghost');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);

    const placeholder = document.createElement('li');
    placeholder.className = 'drawer-drag-placeholder';
    placeholder.style.height = `${rect.height}px`;
    const originLi = button.closest('li');
    originLi?.parentNode?.insertBefore(placeholder, originLi.nextSibling);

    button.classList.add('is-dragging-origin');
    drawerDragState = {
      pointerId: event.pointerId,
      item,
      fromTier: tier,
      fromIndex: index,
      originButton: button,
      originLi,
      ghost,
      placeholder,
      offsetX: Math.min(28, rect.width / 2),
      offsetY: Math.min(20, rect.height / 2),
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      dragging: true,
    };
    updateDrawerDrag(event.clientX, event.clientY);
  }

  function onDrawerItemPointerDown(event, button, item, tier, index) {
    if (event.button !== undefined && event.button !== 0) return;
    if (drawerDragState) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (moveEvent) => {
      if (drawerDragState?.pointerId && moveEvent.pointerId !== drawerDragState.pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!drawerDragState) {
        if (Math.hypot(dx, dy) < 6) return;
        startDrawerDrag(moveEvent, button, item, tier, index);
      } else {
        updateDrawerDrag(moveEvent.clientX, moveEvent.clientY);
      }
    };
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (drawerDragState) finishDrawerDrag(false);
    };
    const onCancel = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (drawerDragState) finishDrawerDrag(true);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onCancel, true);
  }

  function renderDrawerList(container, ids, emptyText) {
    if (!container) return;
    container.innerHTML = '';
    const items = ids.map(drawerItemDataFromId).filter(Boolean);
    const tier = container.dataset.tier || 'primary';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'drawer-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'drawer-list';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      li.dataset.tier = tier;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'drawer-item';
      button.innerHTML = `
        <div class="drawer-item-top">
          <span class="drawer-item-id">${item.id}</span>
          <span class="drawer-item-hall">${item.hall}</span>
        </div>
        <div class="drawer-item-name">${item.boothName}</div>
        <div class="drawer-item-meta">${item.category}</div>
      `;
      button.addEventListener('pointerdown', (event) => onDrawerItemPointerDown(event, button, item, tier, index));
      button.addEventListener('click', () => {
        if (performance.now() < drawerDragSuppressUntil) return;
        setPinnedMesh(item.mesh);
        setHoveredMesh(item.mesh);
        refreshMaterials();
        focusMesh(item.mesh);
        if (window.innerWidth <= 900) setDrawerOpen(false);
        showToast(`${item.id} を表示しました`);
        saveState();
      });
      li.appendChild(button);
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function renderDrawerLists() {
    renderDrawerList(drawerPrimaryList, getSelectedPrimaryIds(), 'まだ選択されていません。');
    renderDrawerList(drawerSecondaryList, getSelectedSecondaryIds(), 'まだ選択されていません。');
  }

  function setDrawerOpen(next) {
    isDrawerOpen = !!next;
    bottomDrawer?.classList.toggle('is-open', isDrawerOpen);
    bottomDrawer?.setAttribute('aria-expanded', String(isDrawerOpen));
    drawerPeek?.setAttribute('aria-expanded', String(isDrawerOpen));
  }

  function toggleDrawer() {
    setDrawerOpen(!isDrawerOpen);
  }

  return {
    drawerItemDataFromId,
    renderDrawerLists,
    setDrawerOpen,
    toggleDrawer,
  };
}
