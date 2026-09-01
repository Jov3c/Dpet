const PEEK_ROTATION = { top: 180, bottom: 0, left: 90, right: -90 };

function applyPeekStyle(pet, edge) {
  pet.style.position = "absolute";
  pet.style.width = "115px";
  pet.style.height = "38px";
  pet.style.left = "50%";
  pet.style.top = "50%";
  pet.style.transform = `translate(-50%, -50%) rotate(${PEEK_ROTATION[edge] ?? 0}deg)`;
}

function clearPeekStyle(pet) {
  pet.style.position = "";
  pet.style.width = "";
  pet.style.height = "";
  pet.style.left = "";
  pet.style.top = "";
}

export function applyPetVisual(pet, theme, state) {
  if (state.mode === "tucked") {
    if (pet.dataset.asset !== theme.peek) {
      pet.dataset.asset = theme.peek;
      pet.src = `../../assets/roach-topdown/${theme.peek}`;
      pet.alt = "藏在屏幕边缘的蟑螂触须";
    }
    applyPeekStyle(pet, state.tuckedEdge);
    return true;
  }
  const asset = theme.reactions[state.mode] || theme.states[state.mode] || theme.states.idle;
  if (pet.dataset.asset !== asset) {
    pet.dataset.asset = asset;
    pet.src = `../../assets/roach-topdown/${asset}`;
    pet.alt = `写实俯视蟑螂：${state.mode}`;
    clearPeekStyle(pet);
    pet.style.transform = `rotate(${(state.heading * 180 / Math.PI) + 90}deg)`;
    return true;
  }
  clearPeekStyle(pet);
  pet.style.transform = `rotate(${(state.heading * 180 / Math.PI) + 90}deg)`;
  return false;
}
