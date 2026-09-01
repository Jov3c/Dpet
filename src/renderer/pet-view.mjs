const PEEK_ROTATION = { top: 180, bottom: 0, left: 90, right: -90 };
// Must match assets/roach-topdown/animations/peek-115x38.apng
const PEEK_WIDTH = 115;
const PEEK_HEIGHT = 38;

// The peek sprite is 160x42 while the window is its rotated size on the
// left/right edges. Sizing the element to the sprite (not 100%x100%) and
// centering it keeps object-fit from downscaling the antennae, so the rotated
// sprite fills the window and its roots reach the screen edge.
function applyPeekStyle(pet, edge) {
  pet.style.position = "absolute";
  pet.style.width = `${PEEK_WIDTH}px`;
  pet.style.height = `${PEEK_HEIGHT}px`;
  pet.style.left = "50%";
  pet.style.top = "50%";
  pet.style.margin = "0";
  pet.style.transform = `translate(-50%, -50%) rotate(${PEEK_ROTATION[edge] ?? 0}deg)`;
}

function clearPeekStyle(pet) {
  pet.style.position = "";
  pet.style.width = "";
  pet.style.height = "";
  pet.style.left = "";
  pet.style.top = "";
  pet.style.margin = "";
}

export function applyPetVisual(pet, theme, state) {
  if (state.mode === "tucked") {
    const asset = theme.peek;
    if (pet.dataset.asset !== asset) {
      pet.dataset.asset = asset;
      pet.src = `../../assets/roach-topdown/${asset}`;
      pet.alt = "蟑螂的触须";
      applyPeekStyle(pet, state.tuckedEdge);
      return true;
    }
    applyPeekStyle(pet, state.tuckedEdge);
    return false;
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
