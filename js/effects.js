// effects.js — geçici görsel durumlar (slash, hasar sayısı, yıldız, halka).
// Renderer state.effects dizisini çizer; burada yalnızca ömür yönetimi var.

export function updateEffects(state, dt) {
  const fx = state.effects;
  for (let i = fx.length - 1; i >= 0; i--) {
    fx[i].t += dt;
    if (fx[i].t >= fx[i].dur) fx.splice(i, 1);
  }
}

export function addEffect(state, fx) {
  if (state.effects.length > 240) state.effects.shift();
  state.effects.push(fx);
}
